import { RetryConfig } from "../types/SDKConfig";

/**
 * RetryPolicy - Determines which errors are retryable and calculates retry delays.
 * 
 * Features:
 * - Identifies retryable vs permanent errors based on HTTP status codes
 * - Implements exponential backoff with optional jitter
 * - Respects maximum retry attempts
 * - Uses jitter to prevent thundering herd effect
 * 
 * Non-retryable codes: 400 (Bad Request), 401 (Unauthorized), 422 (Unprocessable)
 * Retryable codes: 429 (Too Many Requests), 5xx (Server Errors)
 */
export class RetryPolicy {
  /**
   * Constructs a RetryPolicy with specified configuration.
   * 
   * @param config - Retry configuration including attempts, delays, and jitter settings
   */
  constructor(private readonly config: RetryConfig) {}

  /**
   * Determines if an error should be retried.
   * 
   * Returns false if:
   * - Maximum attempts exceeded
   * - Error is a known permanent failure (4xx except 429)
   * 
   * Returns true for all other errors.
   * 
   * @param error - Error object from failed send attempt
   * @param attempt - Current attempt number (1-based)
   * @returns True if the error should be retried, false if it's permanent
   */
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

  /**
   * Calculates the delay before the next retry attempt.
   * 
   * Uses exponential backoff formula:
   * delay = min(base * 2^attempt + jitter, maxDelay)
   * 
   * Jitter is a random value 0-250ms added to prevent synchronized retries.
   * 
   * @param attempt - Current attempt number (0-based index)
   * @returns Delay in milliseconds before next retry
   * 
   * @example
   * // With baseDelayMs: 1000, maxAttempts: 3
   * getDelay(0) // ~1000-1250ms (1 second + jitter)
   * getDelay(1) // ~2000-2250ms (2 seconds + jitter)
   * getDelay(2) // ~4000-4250ms (4 seconds + jitter)
   */
  public getDelay(attempt: number): number {
    const jitter = this.config.jitter ? Math.floor(Math.random() * 250) : 0;
    return Math.min(this.config.baseDelayMs * Math.pow(2, attempt) + jitter, this.config.maxDelayMs);
  }

  /**
   * Extracts HTTP status code from an error object.
   * 
   * Looks for code property which can be a number or numeric string.
   * Returns undefined if no valid code found.
   * 
   * @param error - Error object to extract code from
   * @returns HTTP status code, or undefined if not found
   */
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
