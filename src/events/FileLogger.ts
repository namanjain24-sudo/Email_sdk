import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { EmailEventEmitter } from "./EmailEventEmitter";
import { EmailEventName } from "../types/Events";

/**
 * FileLogger - Logs email events to a file.
 * 
 * Attaches to email event emitter and appends JSON-formatted
 * event records to a specified file, creating directories as needed.
 */
export class FileLogger {
  /**
   * Constructs a FileLogger with specified log file path.
   * 
   * @param filePath - Path to log file (creates directories if needed)
   */
  constructor(private readonly filePath: string) {}

  /**
   * Attaches this logger to an EmailEventEmitter.
   * 
   * Subscribes to all email events and appends them to the log file.
   * Creates the file and directories if they don't exist.
   * 
   * @param emitter - Event emitter to listen to
   */
  public attach(emitter: EmailEventEmitter): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const events: EmailEventName[] = [
      "email.queued",
      "email.sent",
      "email.failed",
      "email.retrying",
      "email.bounced"
    ];
    for (const eventName of events) {
      emitter.on(eventName, (payload) => {
        appendFileSync(this.filePath, `${JSON.stringify({ event: eventName, ...payload })}\n`, "utf8");
      });
    }
  }
}
