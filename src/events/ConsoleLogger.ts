import { EmailEventEmitter } from "./EmailEventEmitter";
import { EmailEventName } from "../types/Events";

/**
 * ConsoleLogger - Logs email events to console (stdout).
 * 
 * Implements simple logging by attaching to email event emitter
 * and printing JSON-formatted event data to console.
 */
export class ConsoleLogger {
  /**
   * Attaches this logger to an EmailEventEmitter.
   * 
   * Subscribes to all email events (queued, sent, failed, retrying, bounced)
   * and logs them to console as JSON.
   * 
   * @param emitter - Event emitter to listen to
   */
  public attach(emitter: EmailEventEmitter): void {
    const events: EmailEventName[] = [
      "email.queued",
      "email.sent",
      "email.failed",
      "email.retrying",
      "email.bounced"
    ];
    for (const eventName of events) {
      emitter.on(eventName, (payload) => {
        console.log(JSON.stringify({ event: eventName, ...payload }));
      });
    }
  }
}
