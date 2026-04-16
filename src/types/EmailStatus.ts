/**
 * EmailStatus - Enumeration of possible email message states.
 * 
 * Tracks the lifecycle of an email from queue through delivery or failure.
 */
export enum EmailStatus {
  /** Email added to queue waiting for processing */
  QUEUED = "queued",
  /** Email currently being sent (retry attempt in progress) */
  PROCESSING = "processing",
  /** Email successfully sent */
  SENT = "sent",
  /** Email permanently failed (all retries exhausted) */
  FAILED = "failed",
  /** Email failed but will be retried */
  RETRYING = "retrying"
}
