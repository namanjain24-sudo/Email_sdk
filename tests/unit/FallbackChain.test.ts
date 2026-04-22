import { describe, expect, it } from "vitest";
import { FallbackChain } from "../../src/delivery/FallbackChain";
import { CircuitBreaker } from "../../src/delivery/CircuitBreaker";
import { MockProvider } from "../../src/providers/MockProvider";

describe("FallbackChain", () => {
  it("filters providers when breaker is OPEN", () => {
    const p1 = new MockProvider("p1", { failureRate: 0 });
    const p2 = new MockProvider("p2", { failureRate: 0 });
    const breakers = new Map<string, CircuitBreaker>([
      ["p1", new CircuitBreaker({ failureThreshold: 1, recoveryTimeMs: 10_000 })],
      ["p2", new CircuitBreaker({ failureThreshold: 1, recoveryTimeMs: 10_000 })]
    ]);
    breakers.get("p1")!.recordFailure();
    const chain = new FallbackChain([p1, p2], breakers);
    expect(chain.orderedAvailable().map((p) => p.name)).toEqual(["p2"]);
  });
});

