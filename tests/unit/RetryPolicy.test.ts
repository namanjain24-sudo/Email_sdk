import { describe, expect, it } from "vitest";
import { RetryPolicy } from "../../src/delivery/RetryPolicy";

describe("RetryPolicy", () => {
  const policy = new RetryPolicy({
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    jitter: false
  });

  it("retries on 5xx/429 and stops on 400", () => {
    expect(policy.shouldRetry({ code: 500 }, 1)).toBe(true);
    expect(policy.shouldRetry({ code: 429 }, 1)).toBe(true);
    expect(policy.shouldRetry({ code: 400 }, 1)).toBe(false);
  });

  it("applies exponential backoff", () => {
    expect(policy.getDelay(0)).toBe(100);
    expect(policy.getDelay(1)).toBe(200);
    expect(policy.getDelay(2)).toBe(400);
  });
});
