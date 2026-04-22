import { describe, expect, it } from "vitest";
import { RetryPolicy } from "../../src/delivery/RetryPolicy";
import { ProviderError } from "../../src/errors/ProviderError";

describe("RetryPolicy branches", () => {
  it("uses ProviderError.retryable when available", () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false });
    expect(policy.shouldRetry(new ProviderError("x", "c", "p", true, 503), 1)).toBe(true);
    expect(policy.shouldRetry(new ProviderError("x", "c", "p", false, 400), 1)).toBe(false);
  });

  it("parses numeric code from string", () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: false });
    expect(policy.shouldRetry({ code: "503" }, 1)).toBe(true);
    expect(policy.shouldRetry({ code: "400" }, 1)).toBe(false);
  });
});

