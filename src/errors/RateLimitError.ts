import { SDKError } from "./SDKError";

export class RateLimitError extends SDKError {
  constructor(correlationId: string) {
    super("RATE_LIMIT", "Rate limit exceeded", correlationId);
    this.name = "RateLimitError";
  }
}
