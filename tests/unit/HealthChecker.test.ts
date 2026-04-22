import { describe, expect, it } from "vitest";
import { HealthChecker } from "../../src/analytics/HealthChecker";
import { MockProvider } from "../../src/providers/MockProvider";

describe("HealthChecker", () => {
  it("returns a health result per provider", async () => {
    const p1 = new MockProvider("p1");
    const p2 = new MockProvider("p2");
    const checker = new HealthChecker([p1, p2]);
    const results = await checker.check();
    expect(results.map((r) => r.provider).sort()).toEqual(["p1", "p2"]);
  });
});

