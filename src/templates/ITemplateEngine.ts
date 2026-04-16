/**
 * ITemplateEngine - Interface for email template engines.
 * 
 * Template engines compile template strings and render them with data.
 * Different implementations (Handlebars, Mustache) provide varying
 * levels of functionality and syntax complexity.
 * 
 * Generic over compiled template type:
 * - Handlebars: TemplateDelegate (function)
 * - Mustache: string (template stored as-is)
 */
export interface ITemplateEngine<TCompiled = unknown> {
  /**
   * Compiles a template string.
   * 
   * Parses template syntax and returns compiled version
   * optimized for rendering with data.
   * 
   * @param template - Template string (Handlebars or Mustache syntax)
   * @returns Compiled template ready for rendering
   * @throws Error if template syntax is invalid
   */
  compile(template: string): TCompiled;

  /**
   * Renders a compiled template with provided data.
   * 
   * Substitutes template variables with data values
   * and returns final HTML string.
   * 
   * @param compiled - Template compiled by compile()
   * @param data - Data object with variables for template
   * @returns Rendered HTML string
   * @throws Error if rendering fails
   */
  render(compiled: TCompiled, data: Record<string, unknown>): string;
}
