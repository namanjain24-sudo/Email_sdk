import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { QueueJob } from "./EmailQueue";

export interface DLQHandlerOptions {
  /**
   * Absolute path to a JSON file for persisting failed jobs across restarts.
   * If omitted the DLQ is purely in-memory (original behaviour).
   */
  persistPath?: string;
}

export class DLQHandler {
  private readonly failedJobs: QueueJob[] = [];
  private readonly persistPath: string | undefined;

  constructor(options: DLQHandlerOptions = {}) {
    this.persistPath = options.persistPath;
    if (this.persistPath) {
      this.loadFromDisk();
    }
  }

  public add(job: QueueJob): void {
    this.failedJobs.push(job);
    if (this.persistPath) {
      this.flushToDisk();
    }
  }

  public list(): QueueJob[] {
    return [...this.failedJobs];
  }

  /** Remove a job from the DLQ by its id (e.g. after manual reprocessing). */
  public remove(id: string): boolean {
    const idx = this.failedJobs.findIndex((j) => j.id === id);
    if (idx === -1) return false;
    this.failedJobs.splice(idx, 1);
    if (this.persistPath) {
      this.flushToDisk();
    }
    return true;
  }

  /** Clear the DLQ entirely. */
  public clear(): void {
    this.failedJobs.length = 0;
    if (this.persistPath) {
      this.flushToDisk();
    }
  }

  public get size(): number {
    return this.failedJobs.length;
  }

  // ---------------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------------

  private flushToDisk(): void {
    try {
      const dir = dirname(this.persistPath!);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      // Serialise – resolve/reject functions cannot be persisted, omit them.
      const serialisable = this.failedJobs.map(({ resolve: _r, reject: _j, ...rest }) => rest);
      writeFileSync(this.persistPath!, JSON.stringify(serialisable, null, 2), "utf-8");
    } catch {
      // Non-fatal – persistence is best-effort.
    }
  }

  private loadFromDisk(): void {
    try {
      if (!existsSync(this.persistPath!)) return;
      const raw = readFileSync(this.persistPath!, "utf-8");
      const parsed: Omit<QueueJob, "resolve" | "reject">[] = JSON.parse(raw) as never;
      for (const item of parsed) {
        this.failedJobs.push({
          ...item,
          enqueuedAt: new Date(item.enqueuedAt)
        });
      }
    } catch {
      // Corrupt file – start fresh.
    }
  }
}
