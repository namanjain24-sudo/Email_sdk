import { SDKError } from "./SDKError";

export class ProviderError extends SDKError {
  constructor(
    message: string,
    correlationId: string,
    public readonly providerName: string,
    public readonly retryable: boolean,
    public readonly statusCode?: number
  ) {
    super("PROVIDER_ERROR", message, correlationId);
    this.name = "ProviderError";
  }
}
