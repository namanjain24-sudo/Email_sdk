import { SDKError } from "./SDKError";

/**
 * ProviderError - Error thrown when an email provider fails to send.
 * 
 * Includes provider-specific information:
 * - Provider name for identifying which service failed
 * - HTTP status code if available
 * - Retryability flag to indicate if retry should be attempted
 * 
 * Extends SDKError with provider context.
 */
export class ProviderError extends SDKError {
  /**
   * Constructs a ProviderError with detailed provider context.
   * 
   * @param message - Error description
   * @param correlationId - Request correlation ID for tracing
   * @param providerName - Name of the provider that failed
   * @param retryable - Whether this error should trigger a retry
   * @param statusCode - Optional HTTP status code from provider
   */
  constructor(
    message: string,
    correlationId: string,
    public readonly providerName: string,
    public readonly retryable: boolean,
    public readonly statusCode?: number
  ) {
    super("PROVIDER_ERROR", message, correlationId);
    this.name = "ProviderError";
  }
}
