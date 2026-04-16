import { SDKError } from "./SDKError";

/**
 * RateLimitError - Thrown when rate limit is exceeded.
 * 
 * Indicates that a send attempt failed due to rate limiting.
 * Can result from:
 * - Token bucket limit exceeded in "throw" mode
 * - Timeout waiting for rate limit token
 * - Provider-level rate limiting
 */
export class RateLimitError extends SDKError {
  /**
   * Constructs a RateLimitError.
   * 
   * @param correlationId - Request correlation ID for tracing
   */
  constructor(correlationId: string) {
    super("RATE_LIMIT", "Rate limit exceeded", correlationId);
    this.name = "RateLimitError";
  }
}
