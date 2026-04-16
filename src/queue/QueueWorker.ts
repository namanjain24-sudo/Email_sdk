import { DeliveryEngine } from "../delivery/DeliveryEngine";
import { EmailQueue } from "./EmailQueue";
import { SendResult } from "../types/SendResult";
import { DLQHandler } from "./DLQHandler";

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
    while (this.running) {
      const job = this.queue.dequeue();
      if (!job) {
        await this.sleep(this.pollIntervalMs);
        continue;
      }
      try {
        const result = await this.deliveryEngine.deliver(job);
        onProcessed(result);
        job.resolve?.(result);
      } catch (error) {
        this.dlq.add(job);
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
