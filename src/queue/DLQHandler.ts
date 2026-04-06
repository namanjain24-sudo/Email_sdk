import { QueueJob } from "./EmailQueue";

export class DLQHandler {
  private readonly failedJobs: QueueJob[] = [];

  public add(job: QueueJob): void {
    this.failedJobs.push(job);
  }

  public list(): QueueJob[] {
    return [...this.failedJobs];
  }
}
