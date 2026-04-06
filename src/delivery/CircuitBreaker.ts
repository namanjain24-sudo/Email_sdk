import { CircuitBreakerConfig } from "../types/SDKConfig";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private openedAt: number | null = null;

  constructor(private readonly config: CircuitBreakerConfig) {}

  public getState(): CircuitState {
    this.syncState();
    return this.state;
  }

  public isOpen(): boolean {
    return this.getState() === "OPEN";
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
    this.openedAt = null;
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
  }

  private syncState(): void {
    if (this.state !== "OPEN" || this.openedAt === null) {
      return;
    }
    if (Date.now() - this.openedAt >= this.config.recoveryTimeMs) {
      this.state = "HALF_OPEN";
      this.failureCount = 0;
    }
  }
}
