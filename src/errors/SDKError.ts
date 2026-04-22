/**
 * SDKError - Base error class for all Email SDK exceptions.
 * 
 * Extends Error to provide structured error information:
 * - Error code for programmatic error handling
 * - Correlation ID for request tracing
 * - Human-readable error message
 */
export class SDKError extends Error {
  /**
   * Constructs an SDKError with code, message, and correlation ID.
   * 
   * @param code - Error code for categorization (e.g., "PROVIDER_ERROR", "RATE_LIMIT")
   * @param message - Human-readable error description
   * @param correlationId - Request correlation ID for tracing
   */
  constructor(
    public readonly code: string,
    message: string,
    public readonly correlationId: string,
    public readonly timestamp: Date = new Date()
  ) {
    super(message);
    this.name = "SDKError";
  }
}
