import { EmailPayload } from "../types/EmailPayload";
import { SendResult } from "../types/SendResult";
import { QueueFullError } from "../errors/QueueFullError";

/**
 * QueueJob - Represents an email message in the queue with metadata.
 * 
 * Tracks:
 * - Email payload and recipient information
 * - Retry metadata (current attempt count, next retry time)
 * - Original enqueue timestamp for ordering
 * - Promise resolvers for awaiting delivery results
 */
export interface QueueJob {
  /** Unique message ID */
  id: string;
  /** Correlation ID for tracking across multiple events */
  correlationId: string;
  /** The email payload to send */
  payload: EmailPayload;
  /** Current retry attempt count */
  attempts: number;
  /** Timestamp when message was added to queue */
  enqueuedAt: Date;
  /** Timestamp (in milliseconds) when this message can be retried */
  nextRetryAt: number;
  /** Optional promise resolver for awaiting send completion */
  resolve?: (value: SendResult) => void;
  /** Optional promise rejector for awaiting send failure */
  reject?: (reason?: unknown) => void;
}

const PRIORITY_SCORE: Record<"high" | "normal" | "low", number> = {
  high: 0,
  normal: 1,
  low: 2
};

/**
 * EmailQueue - Priority queue for pending email messages.
 * 
 * Features:
 * - FIFO ordering with priority support
 * - Retry-aware: messages scheduled for retry are only dequeued when ready
 * - Size-bounded to prevent memory exhaustion
 * - Sorts by: next retry time, priority, then enqueue time
 */
export class EmailQueue {
  private readonly jobs: QueueJob[] = [];

  /**
   * Constructs an EmailQueue with specified maximum size.
   * 
   * @param maxSize - Maximum number of messages the queue can hold
   */
  constructor(private readonly maxSize: number) {}

  /**
   * Adds a job to the queue if space is available.
   * 
   * Maintains priority ordering based on:
   * 1. Next retry time (messages ready now first)
   * 2. Priority level (high > normal > low)
   * 3. Enqueue time (FIFO for same priority)
   * 
   * @param job - Queue job to add
   * @throws QueueFullError if queue is at max capacity
   */
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

  /**
   * Removes and returns the next job ready for processing.
   * 
   * Only returns jobs whose nextRetryAt is in the past (ready to retry now).
   * Returns null if queue is empty or no jobs are ready.
   * 
   * @returns Next QueueJob ready for processing, or null if none available
   */
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

  /**
   * Returns the current number of jobs in the queue.
   * 
   * @returns Number of jobs currently queued
   */
  public size(): number {
    return this.jobs.length;
  }

  /**
   * Checks if the queue is empty.
   * 
   * @returns True if no jobs in queue, false otherwise
   */
  public isEmpty(): boolean {
    return this.jobs.length === 0;
  }
}
