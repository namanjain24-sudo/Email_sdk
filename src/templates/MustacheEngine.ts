import Mustache from "mustache";
import { ITemplateEngine } from "./ITemplateEngine";

/**
 * MustacheEngine - Template engine using Mustache syntax.
 * 
 * Features:
 * - Minimal, logic-less syntax (no if/each blocks)
 * - Fast and lightweight
 * - Compiled templates returned as strings (no preprocessing)
 * - Good for simple variable substitution
 */
export class MustacheEngine implements ITemplateEngine<string> {
  /**
   * Returns template as-is (Mustache doesn't need compilation).
   * 
   * @param template - Mustache template string
   * @returns Template string (no preprocessing needed)
   */
  public compile(template: string): string {
    return template;
  }

  /**
   * Renders a Mustache template (template string) with data.
   * 
   * Uses Mustache.render to substitute variables and iterate arrays.
   * 
   * @param compiled - Template string from compile()
   * @param data - Data object with variables for template
   * @returns Rendered HTML string
   */
  public render(compiled: string, data: Record<string, unknown>): string {
    return Mustache.render(compiled, data);
  }
}
