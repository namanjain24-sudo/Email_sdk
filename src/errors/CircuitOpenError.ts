import { SDKError } from "./SDKError";

export class CircuitOpenError extends SDKError {
  constructor(correlationId: string, public readonly providerName: string) {
    super("CIRCUIT_OPEN", `Circuit breaker is OPEN for provider '${providerName}'`, correlationId);
    this.name = "CircuitOpenError";
  }
}

