import { EventEmitter } from "events";
import { EmailEventPayload } from "../types/Events";

/**
 * EmailEventEmitter - Event emitter for email lifecycle events.
 * 
 * Extends Node.js EventEmitter with typed email-specific event methods.
 * Allows subscribers to listen to email events:
 * - email.queued: Email added to queue
 * - email.sent: Email successfully sent
 * - email.failed: Email send failed permanently
 * - email.retrying: Email failed but will be retried
 * - email.bounced: Email bounced from provider
 */
export class EmailEventEmitter extends EventEmitter {
  /**
   * Emits an email queued event.
   * 
   * @param payload - Event payload with message and status info
   * @returns True if listeners exist, false otherwise
   */
  public emitQueued(payload: EmailEventPayload): boolean {
    return this.emit("email.queued", payload);
  }

  /**
   * Emits an email successfully sent event.
   * 
   * @param payload - Event payload with delivery status
   * @returns True if listeners exist, false otherwise
   */
  public emitSent(payload: EmailEventPayload): boolean {
    return this.emit("email.sent", payload);
  }

  /**
   * Emits an email failed event.
   * 
   * @param payload - Event payload with failure reason
   * @returns True if listeners exist, false otherwise
   */
  public emitFailed(payload: EmailEventPayload): boolean {
    return this.emit("email.failed", payload);
  }

  /**
   * Emits an email retrying event.
   * 
   * @param payload - Event payload with retry attempt details
   * @returns True if listeners exist, false otherwise
   */
  public emitRetrying(payload: EmailEventPayload): boolean {
    return this.emit("email.retrying", payload);
  }

  /**
   * Emits an email bounced event.
   * 
   * @param payload - Event payload with bounce information
   * @returns True if listeners exist, false otherwise
   */
  public emitBounced(payload: EmailEventPayload): boolean {
    return this.emit("email.bounced", payload);
  }
}
