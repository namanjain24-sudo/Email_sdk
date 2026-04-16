import { CircuitBreakerConfig } from "../types/SDKConfig";

/**
 * CircuitState - Enum of possible circuit breaker states.
 * 
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: After too many failures, requests immediately fail
 * - HALF_OPEN: Recovery phase, testing if service is responsive
 */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * CircuitBreaker - Prevents cascading failures by stopping requests to failing providers.
 * 
 * State machine:
 * CLOSED --[failures >= threshold]--> OPEN
 * OPEN --[recovery time elapsed]--> HALF_OPEN
 * HALF_OPEN --[success]--> CLOSED
 * HALF_OPEN --[failure]--> OPEN
 * 
 * This pattern prevents overwhelming a failing service and allows time for recovery.
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private openedAt: number | null = null;

  /**
   * Constructs a CircuitBreaker with specified configuration.
   * 
   * @param config - Configuration including failure threshold and recovery time
   */
  constructor(private readonly config: CircuitBreakerConfig) {}

  /**
   * Gets the current state of this circuit breaker.
   * 
   * Automatically transitions from OPEN to HALF_OPEN when recovery time has elapsed.
   * 
   * @returns Current circuit state (CLOSED, OPEN, or HALF_OPEN)
   */
  public getState(): CircuitState {
    this.syncState();
    return this.state;
  }

  /**
   * Checks if the circuit is currently open (rejecting requests).
   * 
   * @returns True if circuit is open, false otherwise
   */
  public isOpen(): boolean {
    return this.getState() === "OPEN";
  }

  /**
   * Records a successful request.
   * 
   * Resets failure count and transitions to CLOSED state.
   * This allows the breaker to forget previous failures.
   */
  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
    this.openedAt = null;
  }

  /**
   * Records a failed request.
   * 
   * Increments failure count. If in HALF_OPEN state, immediately opens the circuit.
   * Otherwise, checks if failure threshold is reached and opens if so.
   */
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

  /**
   * Opens the circuit, setting the opened timestamp.
   * 
   * Used internally when failure threshold is reached.
   * The circuit will transition to HALF_OPEN after recoveryTimeMs.
   */
  private open(): void {
    this.state = "OPEN";
    this.openedAt = Date.now();
  }

  /**
   * Synchronizes circuit state based on elapsed time.
   * 
   * If the circuit has been OPEN for longer than recoveryTimeMs,
   * transitions to HALF_OPEN to resume testing the provider.
   */
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
