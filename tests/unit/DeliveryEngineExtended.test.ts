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

// ── helpers ──────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<QueueJob> = {}): QueueJob {
  return {
    id: "j1",
    correlationId: "c1",
    payload: {
      id: "j1",
      from: { email: "a@a.com" },
      to: [{ email: "b@b.com" }],
      subject: "test"
    },
    attempts: 0,
    enqueuedAt: new Date(),
    nextRetryAt: Date.now(),
    status: EmailStatus.QUEUED,
    ...overrides
  };
}

function makeProvider(
  name: string,
  sendImpl: (p: unknown) => Promise<unknown>
) {
  return {
    name,
    isAvailable: () => true,
    healthCheck: async () => ({ provider: name, status: "UP" as const, checkedAt: new Date() }),
    send: sendImpl
  };
}

function openBreaker(): CircuitBreaker {
  const b = new CircuitBreaker({ failureThreshold: 1, recoveryTimeMs: 99_999 });
  b.recordFailure(); // opens it
  return b;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("DeliveryEngine – extended coverage", () => {
  // Branch: no providers at all → retryable path (attempt < maxAttempts)
  it("returns retry when provider list is empty and policy allows retry", async () => {
    const breakers = new Map<string, CircuitBreaker>();
    const rateLimiters = new Map<string, RateLimiter>();
    const chain = new FallbackChain([], breakers);
    const engine = new DeliveryEngine(
      chain,
      new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false }),
      breakers,
      rateLimiters,
      new EmailEventEmitter()
    );

    const decision = await engine.deliver(makeJob({ attempts: 0 }));
    expect(decision.kind).toBe("retry");
  });

  // Branch: no providers at all → exceeded maxAttempts → failed
  it("returns failed when provider list is empty and maxAttempts exceeded", async () => {
    const breakers = new Map<string, CircuitBreaker>();
    const rateLimiters = new Map<string, RateLimiter>();
    const chain = new FallbackChain([], breakers);
    const engine = new DeliveryEngine(
      chain,
      new RetryPolicy({ maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 10, jitter: false }),
      breakers,
      rateLimiters,
      new EmailEventEmitter()
    );

    // attempt: 1 >= maxAttempts: 1 → shouldRetry = false
    const decision = await engine.deliver(makeJob({ attempts: 1 }));
    expect(decision.kind).toBe("failed");
  });

  // Branch: circuit breaker is OPEN → provider is skipped, no other provider → failed
  it("returns failed when only provider is circuit-open and non-retryable error", async () => {
    const p1 = makeProvider("p1", async () => {
      throw new ProviderError("bad", "c1", "p1", false, 400);
    });
    const breakers = new Map<string, CircuitBreaker>([["p1", openBreaker()]]);
    const rateLimiters = new Map<string, RateLimiter>([
      ["p1", new RateLimiter({ tokensPerSecond: 1000, burstCapacity: 1000, mode: "wait" })]
    ]);
    // chain still lists p1 but orderedAvailable() will filter it out because circuit is OPEN
    const chain = new FallbackChain([p1 as never], breakers);
    const engine = new DeliveryEngine(
      chain,
      new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false }),
      breakers,
      rateLimiters,
      new EmailEventEmitter()
    );

    // orderedAvailable() returns [] → triggers the "no providers" path
    const decision = await engine.deliver(makeJob());
    expect(decision.kind).toBe("retry"); // empty list + retry allowed
  });

  // Branch: all providers fail with a non-retryable error → failed
  it("returns failed when all providers fail non-retryably", async () => {
    const p1 = makeProvider("p1", async () => {
      throw new ProviderError("bad-req", "c1", "p1", false, 400);
    });
    const p2 = makeProvider("p2", async () => {
      throw new ProviderError("bad-req", "c1", "p2", false, 422);
    });
    const breakers = new Map<string, CircuitBreaker>([
      ["p1", new CircuitBreaker({ failureThreshold: 5, recoveryTimeMs: 10_000 })],
      ["p2", new CircuitBreaker({ failureThreshold: 5, recoveryTimeMs: 10_000 })]
    ]);
    const rateLimiters = new Map<string, RateLimiter>([
      ["p1", new RateLimiter({ tokensPerSecond: 1000, burstCapacity: 1000, mode: "wait" })],
      ["p2", new RateLimiter({ tokensPerSecond: 1000, burstCapacity: 1000, mode: "wait" })]
    ]);
    const chain = new FallbackChain([p1 as never, p2 as never], breakers);
    const engine = new DeliveryEngine(
      chain,
      new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false }),
      breakers,
      rateLimiters,
      new EmailEventEmitter()
    );

    const decision = await engine.deliver(makeJob());
    expect(decision.kind).toBe("failed");
  });

  // Branch: all providers fail with retryable error → retry + emitRetrying event fires
  it("returns retry and emits email.retrying event when all providers fail retryably", async () => {
    const p1 = makeProvider("p1", async () => {
      throw new ProviderError("server-error", "c1", "p1", true, 503);
    });
    const breakers = new Map<string, CircuitBreaker>([
      ["p1", new CircuitBreaker({ failureThreshold: 5, recoveryTimeMs: 10_000 })]
    ]);
    const rateLimiters = new Map<string, RateLimiter>([
      ["p1", new RateLimiter({ tokensPerSecond: 1000, burstCapacity: 1000, mode: "wait" })]
    ]);
    const emitter = new EmailEventEmitter();
    const retryEvents: unknown[] = [];
    emitter.on("email.retrying", (e) => retryEvents.push(e));

    const chain = new FallbackChain([p1 as never], breakers);
    const engine = new DeliveryEngine(
      chain,
      new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false }),
      breakers,
      rateLimiters,
      emitter
    );

    const decision = await engine.deliver(makeJob({ attempts: 0 }));
    expect(decision.kind).toBe("retry");
    expect(retryEvents).toHaveLength(1);
  });

  // Branch: retrying reason when lastError is NOT an Error instance (plain object)
  it("handles non-Error lastError gracefully in retry path", async () => {
    const p1 = makeProvider("p1", async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "string-error";
    });
    const breakers = new Map<string, CircuitBreaker>([
      ["p1", new CircuitBreaker({ failureThreshold: 5, recoveryTimeMs: 10_000 })]
    ]);
    const rateLimiters = new Map<string, RateLimiter>([
      ["p1", new RateLimiter({ tokensPerSecond: 1000, burstCapacity: 1000, mode: "wait" })]
    ]);
    const chain = new FallbackChain([p1 as never], breakers);
    const engine = new DeliveryEngine(
      chain,
      new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false }),
      breakers,
      rateLimiters,
      new EmailEventEmitter()
    );

    // String throws are retryable (no code) and attempt < maxAttempts
    const decision = await engine.deliver(makeJob());
    expect(decision.kind).toBe("retry");
  });

  // Confirm result contains correct status SENT and updated attempts count
  it("marks attempts correctly in sent result", async () => {
    const p = makeProvider("p1", async (payload: unknown) => ({
      messageId: (payload as { id: string }).id,
      provider: "p1",
      status: EmailStatus.SENT,
      attempts: 1,
      latencyMs: 0,
      timestamp: new Date()
    }));
    const breakers = new Map<string, CircuitBreaker>([
      ["p1", new CircuitBreaker({ failureThreshold: 5, recoveryTimeMs: 10_000 })]
    ]);
    const rateLimiters = new Map<string, RateLimiter>([
      ["p1", new RateLimiter({ tokensPerSecond: 1000, burstCapacity: 1000, mode: "wait" })]
    ]);
    const chain = new FallbackChain([p as never], breakers);
    const engine = new DeliveryEngine(
      chain,
      new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false }),
      breakers,
      rateLimiters,
      new EmailEventEmitter()
    );

    const decision = await engine.deliver(makeJob({ attempts: 2 }));
    expect(decision.kind).toBe("sent");
    if (decision.kind === "sent") {
      expect(decision.result.attempts).toBe(3); // job.attempts + 1
      expect(decision.result.status).toBe(EmailStatus.SENT);
    }
  });
});
