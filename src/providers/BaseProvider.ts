import { EmailPayload } from "../types/EmailPayload";
import { EmailStatus } from "../types/EmailStatus";
import { ProviderHealth } from "../types/ProviderHealth";
import { SendResult } from "../types/SendResult";

/**
 * BaseProvider - Abstract base class for email service providers.
 * 
 * Provides common functionality for all provider implementations:
 * - Message ID generation
 * - Latency measurement
 * - Default health check implementation
 * - Template method pattern for send() with doSend() override point
 * 
 * Subclasses should override doSend() to implement provider-specific sending logic.
 */
export abstract class BaseProvider {
  /**
   * Constructs a BaseProvider with the given name.
   * 
   * @param name - Unique provider identifier (e.g., "sendgrid", "aws-ses")
   */
  constructor(public readonly name: string) {}

  /**
   * Sends an email through this provider with latency tracking.
   * 
   * Template method that:
   * - Generates message ID if not provided
   * - Measures send latency
   * - Calls doSend() for subclass-specific implementation
   * - Returns SendResult with timing information
   * 
   * @param payload - Email payload to send
   * @returns Promise resolving to SendResult with metadata
   */
  public async send(payload: EmailPayload): Promise<SendResult> {
    const startedAt = Date.now();
    const messageId = payload.id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await this.doSend(payload, messageId);
    return {
      messageId,
      provider: this.name,
      status: EmailStatus.SENT,
      attempts: 1,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date()
    };
  }

  /**
   * Performs a health check on this provider.
   * 
   * Default implementation returns UP status. Subclasses can override
   * to implement actual connectivity checks.
   * 
   * @returns Promise resolving to provider health status
   */
  public async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: this.name,
      status: "UP",
      checkedAt: new Date()
    };
  }

  /**
   * Checks if this provider is available.
   * 
   * Default implementation always returns true.
   * Subclasses can override for dynamic availability checks.
   * 
   * @returns True if provider is ready to send emails
   */
  public isAvailable(): boolean {
    return true;
  }

  /**
   * Abstract method for provider-specific send implementation.
   * 
   * Subclasses must override this to implement their provider's API.
   * The base class handles timing and result wrapping.
   * 
   * @param payload - Email payload to send
   * @param messageId - Generated message ID for this email
   * @throws Error if send fails
   */
  protected abstract doSend(payload: EmailPayload, messageId: string): Promise<void>;
}
