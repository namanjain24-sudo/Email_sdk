import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { EmailEventEmitter } from "./EmailEventEmitter";
import { EmailEventName } from "../types/Events";

export class FileLogger {
  constructor(private readonly filePath: string) {}

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
