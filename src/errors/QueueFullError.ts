import { SDKError } from "./SDKError";

export class QueueFullError extends SDKError {
  constructor(correlationId: string) {
    super("QUEUE_FULL", "Queue reached max capacity", correlationId);
    this.name = "QueueFullError";
  }
}
