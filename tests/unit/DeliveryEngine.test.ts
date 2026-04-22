import { describe, expect, it } from "vitest";
import { DeliveryEngine } from "../../src/delivery/DeliveryEngine";
import { FallbackChain } from "../../src/delivery/FallbackChain";
import { RetryPolicy } from "../../src/delivery/RetryPolicy";
import { CircuitBreaker } from "../../src/delivery/CircuitBreaker";
import { RateLimiter } from "../../src/delivery/RateLimiter";
import { EmailEventEmitter } from "../../src/events/EmailEventEmitter";
import { ProviderError } from "../../src/errors/ProviderError";
import type { QueueJob } from "../../src/queue/EmailQueue";
import { EmailStatus } from "../../src/types/EmailStatus";

describe("DeliveryEngine", () => {
  it("tries next provider when first fails non-retryably", async () => {
    const p1 = {
      name: "p1",
      isAvailable: () => true,
      healthCheck: async () => ({ provider: "p1", status: "UP", checkedAt: new Date() }),
      send: async () => {
        throw new ProviderError("bad request", "c1", "p1", false, 400);
      }
    };
    const p2 = {
      name: "p2",
      isAvailable: () => true,
      healthCheck: async () => ({ provider: "p2", status: "UP", checkedAt: new Date() }),
      send: async (payload: { id?: string }) => ({
        messageId: payload.id ?? "m",
        provider: "p2",
        status: EmailStatus.SENT,
        attempts: 1,
        latencyMs: 1,
        timestamp: new Date()
      })
    };

    const breakers = new Map<string, CircuitBreaker>([
      ["p1", new CircuitBreaker({ failureThreshold: 1, recoveryTimeMs: 10_000 })],
      ["p2", new CircuitBreaker({ failureThreshold: 1, recoveryTimeMs: 10_000 })]
    ]);
    const rateLimiters = new Map<string, RateLimiter>([
      ["p1", new RateLimiter({ tokensPerSecond: 1000, burstCapacity: 1000, mode: "wait" })],
      ["p2", new RateLimiter({ tokensPerSecond: 1000, burstCapacity: 1000, mode: "wait" })]
    ]);
    const chain = new FallbackChain([p1 as never, p2 as never], breakers);
    const engine = new DeliveryEngine(chain, new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false }), breakers, rateLimiters, new EmailEventEmitter());

    const job: QueueJob = {
      id: "m1",
      correlationId: "c1",
      payload: { id: "m1", from: { email: "a@a.com" }, to: [{ email: "b@b.com" }], subject: "s" },
      attempts: 0,
      enqueuedAt: new Date(),
      nextRetryAt: Date.now(),
      status: EmailStatus.QUEUED
    };

    const decision = await engine.deliver(job);
    expect(decision.kind).toBe("sent");
    if (decision.kind === "sent") {
      expect(decision.result.provider).toBe("p2");
    }
  });
});

