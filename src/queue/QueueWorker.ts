import { DeliveryEngine } from "../delivery/DeliveryEngine";
import { EmailQueue } from "./EmailQueue";
import { SendResult } from "../types/SendResult";
import { DLQHandler } from "./DLQHandler";

export class QueueWorker {
  private running = false;
  private loops: Promise<void>[] = [];

  constructor(
    private readonly queue: EmailQueue,
    private readonly deliveryEngine: DeliveryEngine,
    private readonly dlq: DLQHandler,
    private readonly concurrency: number,
    private readonly pollIntervalMs: number
  ) {}

  public start(onProcessed: (result: SendResult) => void, onError: (error: unknown) => void): void {
    if (this.running) {
      return;
    }
    this.running = true;
    for (let i = 0; i < this.concurrency; i += 1) {
      this.loops.push(this.workerLoop(onProcessed, onError));
    }
  }

  public async stop(): Promise<void> {
    this.running = false;
    await Promise.all(this.loops);
    this.loops = [];
  }

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

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
