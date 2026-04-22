import { EmailPayload } from "../types/EmailPayload";
import { SendResult } from "../types/SendResult";
import { QueueFullError } from "../errors/QueueFullError";
import { EmailStatus } from "../types/EmailStatus";

export interface QueueJob {
  id: string;
  correlationId: string;
  payload: EmailPayload;
  attempts: number;
  enqueuedAt: Date;
  nextRetryAt: number;
  status: EmailStatus;
  resolve?: (value: SendResult) => void;
  reject?: (reason?: unknown) => void;
}

const PRIORITY_SCORE: Record<"high" | "normal" | "low", number> = {
  high: 0,
  normal: 1,
  low: 2
};

class AsyncMutex {
  private locked = false;
  private readonly waiters: Array<() => void> = [];

  public async runExclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.locked = true;
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
      return;
    }
    this.locked = false;
  }
}

export class EmailQueue {
  private readonly jobs: QueueJob[] = [];
  private readonly mutex = new AsyncMutex();

  constructor(private readonly maxSize: number) {}

  public async enqueue(job: QueueJob): Promise<void> {
    await this.mutex.runExclusive(() => {
      if (this.jobs.length >= this.maxSize) {
        throw new QueueFullError(job.correlationId);
      }
      this.jobs.push(job);
      this.sortUnsafe();
    });
  }

  public async dequeue(): Promise<QueueJob | null> {
    return this.mutex.runExclusive(() => {
      if (this.jobs.length === 0) {
        return null;
      }
      const first = this.jobs[0];
      if (first.nextRetryAt > Date.now()) {
        return null;
      }
      return this.jobs.shift() ?? null;
    });
  }

  private sortUnsafe(): void {
    const now = Date.now();
    this.jobs.sort((a, b) => {
      const aReady = a.nextRetryAt <= now;
      const bReady = b.nextRetryAt <= now;
      // Never let a not-ready job block ready jobs.
      if (aReady !== bReady) {
        return aReady ? -1 : 1;
      }
      // If both are not ready, order by retry time.
      if (!aReady && a.nextRetryAt !== b.nextRetryAt) {
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
}
