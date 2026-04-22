import { describe, expect, it } from "vitest";
import { TemplateCache } from "../../src/templates/TemplateCache";

describe("TemplateCache", () => {
  it("evicts least-recently-used entry", () => {
    const cache = new TemplateCache<string>(2);
    cache.set("a", "A");
    cache.set("b", "B");
    // Touch a so b becomes LRU
    expect(cache.get("a")).toBe("A");
    cache.set("c", "C");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("A");
    expect(cache.get("c")).toBe("C");
  });
});

