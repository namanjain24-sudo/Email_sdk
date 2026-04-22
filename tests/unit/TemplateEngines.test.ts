import { describe, expect, it } from "vitest";
import { HandlebarsEngine } from "../../src/templates/HandlebarsEngine";
import { MustacheEngine } from "../../src/templates/MustacheEngine";

describe("Template engines", () => {
  it("HandlebarsEngine compiles and renders", () => {
    const engine = new HandlebarsEngine();
    const compiled = engine.compile("<h1>{{title}}</h1>");
    expect(engine.render(compiled, { title: "Hello" })).toBe("<h1>Hello</h1>");
    const typed = engine.compileTyped<{ title: string }>("<p>{{title}}</p>");
    expect(typed({ title: "T" })).toBe("<p>T</p>");
  });

  it("MustacheEngine compiles and renders", () => {
    const engine = new MustacheEngine();
    const compiled = engine.compile("Hi {{name}}");
    expect(engine.render(compiled, { name: "A" })).toBe("Hi A");
    const typed = engine.compileTyped<{ name: string }>("Yo {{name}}");
    expect(typed({ name: "B" })).toBe("Yo B");
  });
});

