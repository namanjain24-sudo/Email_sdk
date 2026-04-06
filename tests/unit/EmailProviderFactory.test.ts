import { describe, expect, it } from "vitest";
import { EmailProviderFactory } from "../../src/providers/EmailProviderFactory";

describe("EmailProviderFactory", () => {
  it("creates a mock provider", () => {
    const provider = EmailProviderFactory.create({
      type: "mock",
      options: { failureRate: 0 },
      name: "mock-test"
    });
    expect(provider.name).toBe("mock-test");
  });
});
