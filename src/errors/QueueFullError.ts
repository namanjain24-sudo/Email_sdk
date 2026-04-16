import { SDKError } from "./SDKError";

/**
 * QueueFullError - Thrown when attempting to add email to full queue.
 * 
 * Indicates that the queue has reached its maximum capacity
 * and cannot accept new messages. Typically occurs when:
 * - Too many emails sent too quickly
 * - Queue workers are blocked or slow
 * - System is experiencing high load
 */
export class QueueFullError extends SDKError {
  /**
   * Constructs a QueueFullError.
   * 
   * @param correlationId - Request correlation ID for tracing
   */
  constructor(correlationId: string) {
    super("QUEUE_FULL", "Queue reached max capacity", correlationId);
    this.name = "QueueFullError";
  }
}
