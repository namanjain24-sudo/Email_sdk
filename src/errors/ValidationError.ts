import { SDKError } from "./SDKError";

export class ValidationError extends SDKError {
  constructor(message: string, correlationId: string) {
    super("VALIDATION_ERROR", message, correlationId);
    this.name = "ValidationError";
  }
}

