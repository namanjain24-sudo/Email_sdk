import Handlebars, { TemplateDelegate } from "handlebars";
import { ITemplateEngine } from "./ITemplateEngine";

/**
 * HandlebarsEngine - Template engine using Handlebars.js.
 * 
 * Features:
 * - Rich templating syntax with helpers and conditionals
 * - More powerful than Mustache (if/each/with blocks)
 * - Compiled templates return functions (TemplateDelegate)
 * - Allows custom helpers and partials
 */
export class HandlebarsEngine implements ITemplateEngine<TemplateDelegate> {
  /**
   * Compiles a Handlebars template string.
   * 
   * @param template - Handlebars template syntax
   * @returns Compiled template function
   */
  public compile(template: string): TemplateDelegate {
    return Handlebars.compile(template);
  }

  /**
   * Compiles a Handlebars template with type safety.
   * 
   * Generic version provides compile-time typing for template data.
   * Useful for templates with known data structure.
   * 
   * @param template - Handlebars template string
   * @returns Function that accepts typed data and returns HTML
   * 
   * @example
   * const render = engine.compileTyped<{ name: string }>('<h1>Hi {{name}}</h1>');
   * const html = render({ name: 'Alice' }); // Type-safe
   */
  public compileTyped<TSchema extends Record<string, unknown>>(
    template: string
  ): (data: TSchema) => string {
    const compiled = Handlebars.compile(template);
    return (data: TSchema): string => compiled(data);
  }

  /**
   * Renders a compiled Handlebars template.
   * 
   * @param compiled - Template compiled by compile()
   * @param data - Data object for template variables
   * @returns Rendered HTML string
   */
  public render(compiled: TemplateDelegate, data: Record<string, unknown>): string {
    return compiled(data);
  }
}
