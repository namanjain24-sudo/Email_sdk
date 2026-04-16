import { BaseProvider } from "./BaseProvider";
import { EmailPayload } from "../types/EmailPayload";

/**
 * MockProviderOptions - Configuration for MockProvider behavior.
 * 
 * Allows configuring simulated failures and latencies for testing.
 */
export interface MockProviderOptions {
  /** Probability (0-1) of simulating a failed send (default: 0) */
  failureRate?: number;
  /** Simulated send latency in milliseconds (default: 30) */
  baseLatencyMs?: number;
}

/**
 * MockProvider - Test provider that simulates email sending behavior.
 * 
 * Useful for:
 * - Integration testing without external dependencies
 * - Testing retry logic and error handling
 * - Performance testing with controllable latencies
 * - Simulating provider failures and recovery
 * 
 * Can be configured with failure rate and latency to test different scenarios.
 */
export class MockProvider extends BaseProvider {
  private readonly failureRate: number;
  private readonly baseLatencyMs: number;

  /**
   * Constructs a MockProvider with optional behavior configuration.
   * 
   * @param name - Provider name (default: "mock")
   * @param options - Configuration for failure simulation
   */
  constructor(name = "mock", options: MockProviderOptions = {}) {
    super(name);
    this.failureRate = options.failureRate ?? 0;
    this.baseLatencyMs = options.baseLatencyMs ?? 30;
  }

  /**
   * Simulates email sending with optional failures.
   * 
   * Sleeps for baseLatencyMs to simulate network latency,
   * then randomly fails based on failureRate if enabled.
   * 
   * @param payload - Email payload (unused in mock)
   * @param messageId - Message ID (unused in mock)
   * @throws Error with code 503 if failure is simulated
   */
  protected async doSend(payload: EmailPayload, messageId: string): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, this.baseLatencyMs));
    const fail = Math.random() < this.failureRate;
    if (fail) {
      const error = new Error(`Mock provider ${this.name} simulated failure`);
      (error as { code?: number }).code = 503;
      throw error;
    }
    void payload;
    void messageId;
  }
}
