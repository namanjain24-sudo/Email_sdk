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

export class EmailSDK {
  private readonly worker: QueueWorker;

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
    this.worker = new QueueWorker(
      this.queue,
      deliveryEngine,
      this.dlq,
      concurrency,
      pollIntervalMs
    );
    this.worker.start(
      (result) => {
        this.eventEmitter.emitSent({
          messageId: result.messageId,
          correlationId: result.messageId,
          provider: result.provider,
          status: result.status,
          timestamp: new Date().toISOString()
        });
      },
      (error) => {
        this.eventEmitter.emitFailed({
          messageId: "unknown",
          correlationId: "unknown",
          status: EmailStatus.FAILED,
          reason: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString()
        });
      }
    );
  }

  public async send(payload: EmailPayload, options?: { awaitResult?: boolean }): Promise<SendResult> {
    const id = payload.id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const correlationId = `corr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const normalized: EmailPayload = { ...payload, id };
    if (normalized.templateId) {
      const compiled = this.templateCache.get(normalized.templateId);
      if (compiled) {
        normalized.html = this.templateEngine.render(
          compiled as never,
          normalized.templateData ?? {}
        );
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
        this.queue.enqueue({
          id,
          correlationId,
          payload: normalized,
          attempts: 0,
          enqueuedAt: new Date(),
          nextRetryAt: Date.now(),
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

    this.queue.enqueue({
      id,
      correlationId,
      payload: normalized,
      attempts: 0,
      enqueuedAt: new Date(),
      nextRetryAt: Date.now()
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
    return Promise.all(payloads.map((payload) => this.send(payload)));
  }

  public registerTemplate(id: string, template: string): void {
    const compiled = this.templateEngine.compile(template);
    this.templateCache.set(id, compiled);
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
