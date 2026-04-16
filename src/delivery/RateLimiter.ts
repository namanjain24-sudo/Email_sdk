import { RateLimitError } from "../errors/RateLimitError";
import { RateLimitConfig } from "../types/SDKConfig";

/**
 * RateLimiter - Controls email send rate using token bucket algorithm.
 * 
 * Features:
 * - Prevents overwhelming providers with too many simultaneous requests
 * - Token bucket algorithm: tokens are refilled at a specified rate
 * - Supports burst capacity for temporary traffic spikes
 * - Configurable wait vs throw behavior on rate limit
 * 
 * Tokens are consumed when sending an email and refilled over time.
 * If requesting more tokens than available, can either wait or throw error.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefillTs: number;

  /**
   * Constructs a RateLimiter with specified configuration.
   * 
   * Initially fills the bucket to burst capacity.
   * 
   * @param config - Configuration including tokens/second and burst capacity
   */
  constructor(private readonly config: RateLimitConfig) {
    this.tokens = config.burstCapacity;
    this.lastRefillTs = Date.now();
  }

  /**
   * Acquires a token, either by waiting or throwing an error.
   * 
   * If tokens are available, immediately returns. Otherwise:
   * - If mode is "wait": waits up to timeoutMs for a token to become available
   * - If mode is "throw": immediately throws RateLimitError
   * 
   * @param correlationId - Correlation ID for error tracking (if thrown)
   * @param timeoutMs - Maximum time to wait for a token (default: 3000ms)
   * @throws RateLimitError if timeout exceeded or mode is "throw"
   * 
   * @example
   * await limiter.acquire(correlationId, 5000); // Wait up to 5 seconds
   */
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

  /**
   * Refills tokens based on elapsed time since last refill.
   * 
   * Uses formula: tokensToAdd = (elapsedSeconds * tokensPerSecond)
   * Cannot exceed burst capacity. Capped at maxBurstCapacity.
   */
  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTs) / 1000;
    const refill = elapsedSeconds * this.config.tokensPerSecond;
    this.tokens = Math.min(this.config.burstCapacity, this.tokens + refill);
    this.lastRefillTs = now;
  }
}
