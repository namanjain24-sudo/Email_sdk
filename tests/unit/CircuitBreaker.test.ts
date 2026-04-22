import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "../../src/delivery/CircuitBreaker";

describe("CircuitBreaker", () => {
  it("opens after threshold and recovers to half-open", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, recoveryTimeMs: 10 });
    breaker.recordFailure();
    expect(breaker.getState()).toBe("CLOSED");
    breaker.recordFailure();
    expect(breaker.getState()).toBe("OPEN");
    await new Promise((r) => setTimeout(r, 15));
    expect(breaker.getState()).toBe("HALF_OPEN");
    breaker.recordSuccess();
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("allows only a single probe in HALF_OPEN", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, recoveryTimeMs: 10 });
    breaker.recordFailure();
    expect(breaker.getState()).toBe("OPEN");
    await new Promise((r) => setTimeout(r, 15));
    expect(breaker.getState()).toBe("HALF_OPEN");

    expect(breaker.canRequest()).toBe(true);
    expect(breaker.canRequest()).toBe(false);
    breaker.recordFailure();
    expect(breaker.getState()).toBe("OPEN");
  });
});
