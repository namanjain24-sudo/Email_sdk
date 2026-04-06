import { EmailEventEmitter } from "./EmailEventEmitter";
import { EmailEventName } from "../types/Events";

export class ConsoleLogger {
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
