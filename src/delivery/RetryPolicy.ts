import { RetryConfig } from "../types/SDKConfig";

export class RetryPolicy {
  constructor(private readonly config: RetryConfig) {}

  public shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.config.maxAttempts) {
      return false;
    }

    const code = this.extractCode(error);
    if (code === undefined) {
      return true;
    }
    if (code === 400 || code === 401 || code === 422) {
      return false;
    }
    return code === 429 || code >= 500;
  }

  public getDelay(attempt: number): number {
    const jitter = this.config.jitter ? Math.floor(Math.random() * 250) : 0;
    return Math.min(this.config.baseDelayMs * Math.pow(2, attempt) + jitter, this.config.maxDelayMs);
  }

  private extractCode(error: unknown): number | undefined {
    if (!error || typeof error !== "object") {
      return undefined;
    }
    const raw = (error as { code?: unknown }).code;
    if (typeof raw === "number") {
      return raw;
    }
    if (typeof raw === "string") {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }
}
