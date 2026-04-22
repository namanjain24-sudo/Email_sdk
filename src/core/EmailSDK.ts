import { DeliveryEngine } from "../delivery/DeliveryEngine";
import { EmailPayload } from "../types/EmailPayload";
import { EmailStatus } from "../types/EmailStatus";
import { SendResult } from "../types/SendResult";
import { EmailQueue } from "../queue/EmailQueue";
import { QueueWorker } from "../queue/QueueWorker";
import { DLQHandler } from "../queue/DLQHandler";
import { EmailEventEmitter } from "../events/EmailEventEmitter";
import { MetricsCollector } from "../analytics/MetricsCollector";
import { HealthChecker } from "../analytics/HealthChecker";
import { ITemplateEngine } from "../templates/ITemplateEngine";
import { TemplateCache } from "../templates/TemplateCache";
import { EmailEventName } from "../types/Events";
import { SDKStats } from "../types/SDKStats";
import { ProviderHealth } from "../types/ProviderHealth";
import { randomUUID } from "crypto";
import { TemplateError } from "../errors/TemplateError";

export class EmailSDK {
  private readonly worker: QueueWorker;
  private readonly bulkConcurrency: number;

  constructor(
    private readonly queue: EmailQueue,
    private readonly dlq: DLQHandler,
    deliveryEngine: DeliveryEngine,
    private readonly eventEmitter: EmailEventEmitter,
    private readonly metrics: MetricsCollector,
    private readonly healthChecker: HealthChecker,
    private readonly templateEngine: ITemplateEngine,
    private readonly templateCache: TemplateCache<unknown>,
    concurrency: number,
    pollIntervalMs: number
  ) {
    this.bulkConcurrency = Math.max(1, concurrency);
    this.worker = new QueueWorker(
      this.queue,
      deliveryEngine,
      this.dlq,
      this.eventEmitter,
      concurrency,
      pollIntervalMs
    );
    this.worker.start(
      () => {},
      () => {}
    );
  }

  public async send(payload: EmailPayload, options?: { awaitResult?: boolean }): Promise<SendResult> {
    const id = payload.id ?? randomUUID();
    const correlationId = payload.metadata?.correlationId ?? randomUUID();
    const normalized: EmailPayload = {
      ...payload,
      id,
      metadata: { ...(payload.metadata ?? {}), correlationId }
    };
    if (normalized.templateId) {
      const compiled = this.templateCache.get(normalized.templateId);
      if (compiled) {
        try {
          normalized.html = this.templateEngine.render(compiled as never, normalized.templateData ?? {});
        } catch (e) {
          throw new TemplateError(e instanceof Error ? e.message : "Template render failed", correlationId);
        }
      }
    }

    const baseResult: SendResult = {
      messageId: id,
      provider: "queued",
      status: EmailStatus.QUEUED,
      attempts: 0,
      latencyMs: 0,
      timestamp: new Date()
    };

    if (options?.awaitResult) {
      return new Promise<SendResult>((resolve, reject) => {
        void this.queue.enqueue({
          id,
          correlationId,
          payload: normalized,
          attempts: 0,
          enqueuedAt: new Date(),
          nextRetryAt: Date.now(),
          status: EmailStatus.QUEUED,
          resolve,
          reject
        });
        this.eventEmitter.emitQueued({
          messageId: id,
          correlationId,
          status: EmailStatus.QUEUED,
          timestamp: new Date().toISOString()
        });
      });
    }

    await this.queue.enqueue({
      id,
      correlationId,
      payload: normalized,
      attempts: 0,
      enqueuedAt: new Date(),
      nextRetryAt: Date.now(),
      status: EmailStatus.QUEUED
    });
    this.eventEmitter.emitQueued({
      messageId: id,
      correlationId,
      status: EmailStatus.QUEUED,
      timestamp: new Date().toISOString()
    });
    return baseResult;
  }

  public async sendBulk(payloads: EmailPayload[]): Promise<SendResult[]> {
    const results: SendResult[] = [];
    let idx = 0;

    const workers = Array.from({ length: Math.min(this.bulkConcurrency, payloads.length) }).map(async () => {
      while (idx < payloads.length) {
        const current = idx;
        idx += 1;
        const res = await this.send(payloads[current]!, { awaitResult: true });
        results[current] = res;
      }
    });

    await Promise.all(workers);
    return results;
  }

  public registerTemplate(id: string, template: string): void {
    const compiled = this.templateEngine.compile(template);
    this.templateCache.set(id, compiled);
  }

  public registerTemplateTyped<TSchema extends Record<string, unknown>>(id: string, template: string): void {
    const compiled = this.templateEngine.compileTyped<TSchema>(template);
    this.templateCache.set(id, compiled as unknown);
  }

  public getStats(): SDKStats {
    return this.metrics.getStats();
  }

  public async healthCheck(): Promise<ProviderHealth[]> {
    return this.healthChecker.check();
  }

  public on(event: EmailEventName, handler: (payload: unknown) => void): void {
    this.eventEmitter.on(event, handler);
  }

  public async shutdown(): Promise<void> {
    await this.worker.stop();
  }
}
