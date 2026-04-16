import { EmailStatus } from "./EmailStatus";

/**
 * SendResult - Result of an email send attempt.
 * 
 * Contains delivery status, timing, and metadata about the send operation.
 * Returned from SDK send() methods and emit events.
 */
export interface SendResult {
  /** Unique message ID generated for this email */
  messageId: string;
  /** Name of the provider that sent (or attempted to send) the email */
  provider: string;
  /** Current status of the email (QUEUED, SENT, FAILED, RETRYING) */
  status: EmailStatus;
  /** Number of send attempts made (1 if successful on first try) */
  attempts: number;
  /** Milliseconds taken to send (latency) */
  latencyMs: number;
  /** Timestamp when send was completed */
  timestamp: Date;
  /** Optional error message if send failed */
  error?: string;
}
