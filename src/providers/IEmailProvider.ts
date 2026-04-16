import { EmailPayload } from "../types/EmailPayload";
import { ProviderHealth } from "../types/ProviderHealth";
import { SendResult } from "../types/SendResult";

/**
 * IEmailProvider - Interface for email service providers.
 * 
 * Defines the contract that all email providers must implement,
 * including sending emails, health checks, and availability status.
 * 
 * Implementations include SMTP, AWS SES, SendGrid, and Mock providers.
 */
export interface IEmailProvider {
  /**
   * Unique provider name identifier (e.g., "sendgrid", "smtp", "ses").
   * Used for logging, metrics, and provider selection in fallback chains.
   */
  readonly name: string;

  /**
   * Sends an email using this provider.
   * 
   * @param payload - The email payload to send
   * @returns Promise resolving to send result with delivery status and metadata
   * @throws ProviderError if the send operation fails
   */
  send(payload: EmailPayload): Promise<SendResult>;

  /**
   * Performs a health check on the provider.
   * 
   * Tests provider connectivity and readiness to send emails.
   * Used for monitoring and automatic failover decisions.
   * 
   * @returns Promise resolving to provider health status
   */
  healthCheck(): Promise<ProviderHealth>;

  /**
   * Checks if the provider is currently available for sending.
   * 
   * @returns True if the provider can send emails, false otherwise
   */
  isAvailable(): boolean;
}
