/**
 * EmailEventName - Type for valid email event names.
 * 
 * Events are emitted throughout the email lifecycle for integration
 * with logging, analytics, and monitoring systems.
 */
export type EmailEventName =
  | "email.queued"
  | "email.sent"
  | "email.failed"
  | "email.retrying"
  | "email.bounced";

/**
 * EmailEventPayload - Data structure for all email events.
 * 
 * Common fields across all event types, with optional fields
 * based on specific event type.
 */
export interface EmailEventPayload {
  /** Unique message ID for this email */
  messageId: string;
  /** Correlation ID for tracking across related events */
  correlationId: string;
  /** Email provider name (if applicable) */
  provider?: string;
  /** Current email status */
  status: string;
  /** Attempt number (for retrying events) */
  attempt?: number;
  /** Delay in milliseconds before next retry */
  delayMs?: number;
  /** Reason for failure or retry */
  reason?: string;
  /** ISO timestamp of the event */
  timestamp: string;
}
