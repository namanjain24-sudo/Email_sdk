import { CircuitBreakerConfig } from "../types/SDKConfig";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private openedAt: number | null = null;
  private halfOpenProbeInFlight = false;

  constructor(private readonly config: CircuitBreakerConfig) {}

  public getState(): CircuitState {
    this.syncState();
    return this.state;
  }

  public isOpen(): boolean {
    return this.getState() === "OPEN";
  }

  /**
   * HALF_OPEN must allow only a single probe request.
   * Returns true if a request is permitted right now.
   */
  public canRequest(): boolean {
    const state = this.getState();
    if (state === "OPEN") {
      return false;
    }
    if (state === "HALF_OPEN") {
      if (this.halfOpenProbeInFlight) {
        return false;
      }
      this.halfOpenProbeInFlight = true;
      return true;
    }
    return true;
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
    this.openedAt = null;
    this.halfOpenProbeInFlight = false;
  }

  public recordFailure(): void {
    if (this.state === "HALF_OPEN") {
      this.open();
      return;
    }

    this.failureCount += 1;
    if (this.failureCount >= this.config.failureThreshold) {
      this.open();
    }
  }

  private open(): void {
    this.state = "OPEN";
    this.openedAt = Date.now();
    this.halfOpenProbeInFlight = false;
  }

  private syncState(): void {
    if (this.state !== "OPEN" || this.openedAt === null) {
      return;
    }
    if (Date.now() - this.openedAt >= this.config.recoveryTimeMs) {
      this.state = "HALF_OPEN";
      this.failureCount = 0;
      this.halfOpenProbeInFlight = false;
    }
  }
}
