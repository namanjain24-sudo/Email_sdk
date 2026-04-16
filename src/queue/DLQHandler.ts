import { QueueJob } from "./EmailQueue";

/**
 * DLQHandler - Dead Letter Queue for permanently failed email messages.
 * 
 * When an email cannot be delivered after all retry attempts and provider
 * fallbacks are exhausted, it's added to the DLQ for later investigation
 * and potential manual intervention.
 */
export class DLQHandler {
  private readonly failedJobs: QueueJob[] = [];

  /**
   * Adds a failed job to the Dead Letter Queue.
   * 
   * @param job - Queue job that failed delivery
   */
  public add(job: QueueJob): void {
    this.failedJobs.push(job);
  }

  /**
   * Returns a copy of all failed jobs in the Dead Letter Queue.
   * 
   * @returns Array of failed queue jobs
   */
  public list(): QueueJob[] {
    return [...this.failedJobs];
  }
}
