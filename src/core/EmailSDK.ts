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

/**
 * EmailSDK - Core email delivery SDK that orchestrates email sending across multiple providers.
 * 
 * This class manages the complete email delivery lifecycle including:
 * - Queue management and processing
 * - Template compilation and caching
 * - Event emission for tracking and logging
 * - Metrics collection and health monitoring
 * - Graceful shutdown and cleanup
 * 
 * The SDK uses a background worker to asynchronously process emails from the queue.
 */
export class EmailSDK {
  private readonly worker: QueueWorker;

  /**
   * Constructs an EmailSDK instance with all necessary dependencies.
   * 
   * @param queue - The email queue for storing pending messages
   * @param dlq - Dead Letter Queue handler for failed messages
   * @param deliveryEngine - Engine responsible for email delivery with retry and fallback logic
   * @param eventEmitter - Event emitter for system-wide email events
   * @param metrics - Metrics collector for performance tracking
   * @param healthChecker - Health checker for provider status monitoring
   * @param templateEngine - Template engine for compiling email templates
   * @param templateCache - Cache for compiled templates
   * @param concurrency - Number of concurrent workers for email processing
   * @param pollIntervalMs - Interval in milliseconds for polling the queue
   */
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

  /**
   * Sends an email either synchronously (queued) or asynchronously (awaited).
   * 
   * This method:
   * - Generates unique message and correlation IDs
   * - Compiles email templates if a templateId is provided
   * - Queues the email for delivery
   * - Emits a QUEUED event
   * - Optionally waits for the delivery result
   * 
   * @param payload - The email payload containing recipient, subject, and content information
   * @param options - Optional configuration object
   * @param options.awaitResult - If true, waits for delivery result; if false, returns immediately
   * @returns A SendResult containing message ID, provider, status, and delivery metadata
   * 
   * @example
   * const result = await sdk.send(
   *   { from: {...}, to: [...], subject: "Hi", html: "<p>Hello</p>" },
   *   { awaitResult: true }
   * );
   */
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

  /**
   * Sends multiple emails concurrently.
   * 
   * This method batches multiple emails and sends them in parallel, which is more efficient
   * than calling send() individually for each email.
   * 
   * @param payloads - Array of email payloads to send
   * @returns Array of SendResults corresponding to each email payload
   * 
   * @example
   * const results = await sdk.sendBulk([payload1, payload2, payload3]);
   */
  public async sendBulk(payloads: EmailPayload[]): Promise<SendResult[]> {
    return Promise.all(payloads.map((payload) => this.send(payload)));
  }

  /**
   * Registers a template with the template cache for later use.
   * 
   * This method compiles a template using the configured template engine and caches it.
   * When an email includes this templateId, the precompiled template is used instead of
   * compiling it repeatedly.
   * 
   * @param id - Unique identifier for the template
   * @param template - Template string (Handlebars or Mustache syntax)
   * 
   * @example
   * sdk.registerTemplate('welcome-email', '<h1>Welcome {{name}}!</h1>');
   */
  public registerTemplate(id: string, template: string): void {
    const compiled = this.templateEngine.compile(template);
    this.templateCache.set(id, compiled);
  }

  /**
   * Retrieves aggregated statistics about email delivery.
   * 
   * Returns metrics including total emails queued, sent, failed, and per-provider statistics
   * such as success count and failure count for each configured email provider.
   * 
   * @returns SDK stats object containing delivery metrics
   */
  public getStats(): SDKStats {
    return this.metrics.getStats();
  }

  /**
   * Performs health checks on all configured email providers.
   * 
   * This method asynchronously checks the health status of each provider, including
   * availability, response latency, and overall operational status.
   * 
   * @returns Array of ProviderHealth objects indicating the status of each provider
   */
  public async healthCheck(): Promise<ProviderHealth[]> {
    return this.healthChecker.check();
  }

  /**
   * Registers an event listener for system-wide email events.
   * 
   * Allows consumers to listen to email lifecycle events such as queued, sent, failed,
   * retrying, and bounced events. Useful for integration with logging, analytics, and UI updates.
   * 
   * @param event - The event name to listen for
   * @param handler - Callback function invoked when the event is emitted
   * 
   * @example
   * sdk.on('email.sent', (payload) => console.log('Email sent:', payload));
   */
  public on(event: EmailEventName, handler: (payload: unknown) => void): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Gracefully shuts down the SDK.
   * 
   * This method stops all background workers, allowing pending emails to be processed
   * before completely stopping. Call this during application shutdown to ensure clean cleanup.
   */
  public async shutdown(): Promise<void> {
    await this.worker.stop();
  }
}
