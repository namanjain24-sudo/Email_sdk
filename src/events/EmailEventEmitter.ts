import { EventEmitter } from "events";
import { EmailEventPayload } from "../types/Events";

export class EmailEventEmitter extends EventEmitter {
  public emitQueued(payload: EmailEventPayload): boolean {
    return this.emit("email.queued", payload);
  }
  public emitSent(payload: EmailEventPayload): boolean {
    return this.emit("email.sent", payload);
  }
  public emitFailed(payload: EmailEventPayload): boolean {
    return this.emit("email.failed", payload);
  }
  public emitRetrying(payload: EmailEventPayload): boolean {
    return this.emit("email.retrying", payload);
  }
}
