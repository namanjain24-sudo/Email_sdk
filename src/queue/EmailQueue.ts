import { EmailPayload } from "../types/EmailPayload";
import { SendResult } from "../types/SendResult";
import { QueueFullError } from "../errors/QueueFullError";

export interface QueueJob {
  id: string;
  correlationId: string;
  payload: EmailPayload;
  attempts: number;
  enqueuedAt: Date;
  nextRetryAt: number;
  resolve?: (value: SendResult) => void;
  reject?: (reason?: unknown) => void;
}

const PRIORITY_SCORE: Record<"high" | "normal" | "low", number> = {
  high: 0,
  normal: 1,
  low: 2
};

export class EmailQueue {
  private readonly jobs: QueueJob[] = [];

  constructor(private readonly maxSize: number) {}

  public enqueue(job: QueueJob): void {
    if (this.jobs.length >= this.maxSize) {
      throw new QueueFullError(job.correlationId);
    }
    this.jobs.push(job);
    this.jobs.sort((a, b) => {
      if (a.nextRetryAt !== b.nextRetryAt) {
        return a.nextRetryAt - b.nextRetryAt;
      }
      const pa = PRIORITY_SCORE[a.payload.priority ?? "normal"];
      const pb = PRIORITY_SCORE[b.payload.priority ?? "normal"];
      if (pa !== pb) {
        return pa - pb;
      }
      return a.enqueuedAt.getTime() - b.enqueuedAt.getTime();
    });
  }

  public dequeue(): QueueJob | null {
    if (this.jobs.length === 0) {
      return null;
    }
    const first = this.jobs[0];
    if (first.nextRetryAt > Date.now()) {
      return null;
    }
    return this.jobs.shift() ?? null;
  }

  public size(): number {
    return this.jobs.length;
  }

  public isEmpty(): boolean {
    return this.jobs.length === 0;
  }
}
