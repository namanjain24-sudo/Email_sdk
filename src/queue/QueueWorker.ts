import { DeliveryEngine } from "../delivery/DeliveryEngine";
import { EmailQueue } from "./EmailQueue";
import { SendResult } from "../types/SendResult";
import { DLQHandler } from "./DLQHandler";
import { EmailStatus } from "../types/EmailStatus";
import { ProviderError } from "../errors/ProviderError";
import { EmailEventEmitter } from "../events/EmailEventEmitter";

/**
 * QueueWorker - Background worker that processes emails from the queue.
 * 
 * Features:
 * - Runs specified number of concurrent workers
 * - Polls the queue at regular intervals
 * - Delivers emails via the DeliveryEngine
 * - Moves failed emails to Dead Letter Queue (DLQ)
 * - Calls callbacks on success and error
 */
export class QueueWorker {
  private running = false;
  private loops: Promise<void>[] = [];
  private readonly inFlight = new Set<Promise<unknown>>();

  /**
   * Constructs a QueueWorker with configured delivery pipeline.
   * 
   * @param queue - Email queue to poll for messages
   * @param deliveryEngine - Engine to handle email delivery with retries
   * @param dlq - Dead Letter Queue for permanently failed messages
   * @param concurrency - Number of concurrent workers
   * @param pollIntervalMs - Interval in milliseconds to check for new messages
   */
  constructor(
    private readonly queue: EmailQueue,
    private readonly deliveryEngine: DeliveryEngine,
    private readonly dlq: DLQHandler,
    private readonly eventEmitter: EmailEventEmitter,
    private readonly concurrency: number,
    private readonly pollIntervalMs: number
  ) {}

  /**
   * Starts the background workers.
   * 
   * Creates and runs specified number of concurrent worker loops, each:
   * - Polling the queue for new messages
   * - Delivering emails via the delivery engine
   * - Calling onProcessed for successful sends
   * - Moving failures to DLQ and calling onError
   * 
   * @param onProcessed - Callback invoked when email successfully processed
   * @param onError - Callback invoked when processing fails
   */
  public start(onProcessed: (result: SendResult) => void, onError: (error: unknown) => void): void {
    if (this.running) {
      return;
    }
    this.running = true;
    for (let i = 0; i < this.concurrency; i += 1) {
      this.loops.push(this.workerLoop(onProcessed, onError));
    }
  }

  /**
   * Stops the background workers gracefully.
   * 
   * Sets running flag to false, allowing worker loops to exit,
   * then waits for all loops to complete.
   */
  public async stop(): Promise<void> {
    this.running = false;
    await Promise.all(this.loops);
    await Promise.allSettled([...this.inFlight]);
    this.loops = [];
  }

  /**
   * Worker loop - continuously polls and processes messages from the queue.
   * 
   * For each message:
   * - Delivers via DeliveryEngine
   * - On success: resolves job promise and calls onProcessed
   * - On failure: adds to DLQ, rejects job promise, calls onError
   * - Sleeps between polls when queue is empty
   * 
   * @param onProcessed - Success callback
   * @param onError - Error callback
   */
  private async workerLoop(
    onProcessed: (result: SendResult) => void,
    onError: (error: unknown) => void
  ): Promise<void> {
    let emptyBackoffMs = Math.min(this.pollIntervalMs, 100);
    while (this.running) {
      const job = await this.queue.dequeue();
      if (!job) {
        emptyBackoffMs = Math.min(this.pollIntervalMs, Math.max(10, emptyBackoffMs * 2));
        await this.sleep(emptyBackoffMs);
        continue;
      }
      emptyBackoffMs = 10;
      try {
        const work = this.deliveryEngine.deliver(job);
        this.inFlight.add(work);
        const decision = await work;
        this.inFlight.delete(work);
        if (decision.kind === "sent") {
          this.eventEmitter.emitSent({
            messageId: job.id,
            correlationId: job.correlationId,
            provider: decision.result.provider,
            status: EmailStatus.SENT,
            latencyMs: decision.result.latencyMs,
            timestamp: new Date().toISOString()
          });
          onProcessed(decision.result);
          job.resolve?.(decision.result);
          continue;
        }

        if (decision.kind === "retry") {
          job.attempts += 1;
          job.status = EmailStatus.RETRYING;
          job.nextRetryAt = Date.now() + decision.delayMs;
          await this.queue.enqueue(job);
          continue;
        }

        // Terminal failure: send to DLQ
        job.attempts += 1;
        job.status = EmailStatus.DLQ;
        this.dlq.add(job);
        const error =
          decision.error ??
          new ProviderError("Delivery failed", job.correlationId, decision.providerName ?? "unknown", false);
        this.eventEmitter.emitFailed({
          messageId: job.id,
          correlationId: job.correlationId,
          provider: decision.providerName,
          status: EmailStatus.FAILED,
          reason: error instanceof Error ? error.message : "Delivery failed",
          timestamp: new Date().toISOString()
        });
        job.reject?.(error);
        onError(error);
      } catch (error) {
        job.status = EmailStatus.DLQ;
        this.dlq.add(job);
        this.eventEmitter.emitFailed({
          messageId: job.id,
          correlationId: job.correlationId,
          status: EmailStatus.FAILED,
          reason: error instanceof Error ? error.message : "Delivery failed",
          timestamp: new Date().toISOString()
        });
        job.reject?.(error);
        onError(error);
      }
    }
  }

  /**
   * Utility method to sleep for specified milliseconds.
   * 
   * @param ms - Milliseconds to sleep
   */
  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
