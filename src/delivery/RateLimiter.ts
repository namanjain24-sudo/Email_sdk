import { RateLimitError } from "../errors/RateLimitError";
import { RateLimitConfig } from "../types/SDKConfig";

export class RateLimiter {
  private tokens: number;
  private lastRefillTs: number;

  constructor(private readonly config: RateLimitConfig) {
    this.tokens = config.burstCapacity;
    this.lastRefillTs = Date.now();
  }

  public async acquire(correlationId: string, timeoutMs = 3000): Promise<void> {
    const started = Date.now();
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      if (this.config.mode === "throw") {
        throw new RateLimitError(correlationId);
      }
      if (Date.now() - started > timeoutMs) {
        throw new RateLimitError(correlationId);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTs) / 1000;
    const refill = elapsedSeconds * this.config.tokensPerSecond;
    this.tokens = Math.min(this.config.burstCapacity, this.tokens + refill);
    this.lastRefillTs = now;
  }
}
