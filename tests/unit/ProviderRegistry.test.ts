import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "../../src/providers/ProviderRegistry";
import { MockProvider } from "../../src/providers/MockProvider";

describe("ProviderRegistry", () => {
  it("registers and retrieves providers", () => {
    const registry = new ProviderRegistry();
    const p = new MockProvider("p1");
    registry.register(p);
    expect(registry.get("p1")?.name).toBe("p1");
    expect(registry.list().length).toBe(1);
  });
});

