import { describe, expect, it } from "vitest";
import { RateLimiter } from "../../src/delivery/RateLimiter";

describe("RateLimiter", () => {
  it("allows burst and then throttles", async () => {
    const limiter = new RateLimiter({
      tokensPerSecond: 1,
      burstCapacity: 1,
      mode: "throw"
    });
    await limiter.acquire("c1");
    await expect(limiter.acquire("c1", 20)).rejects.toThrow();
  });
});
