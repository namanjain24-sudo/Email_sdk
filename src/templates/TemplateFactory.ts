import { HandlebarsEngine } from "./HandlebarsEngine";
import { ITemplateEngine } from "./ITemplateEngine";
import { MustacheEngine } from "./MustacheEngine";

/**
 * TemplateEngineType - Supported template engine types.
 * 
 * -  "handlebars": Handlebars syntax with helpers and complex logic
 * - "mustache": Simple mustache syntax with minimal logic
 * - "mjml": (Mapped to Handlebars) for responsive email markup
 */
export type TemplateEngineType = "handlebars" | "mustache" | "mjml";

/**
 * TemplateFactory - Factory for creating template engine instances.
 * 
 * Decouples template engine selection from consumer code.
 * Provides compile() and render() methods for templates.
 */
export class TemplateFactory {
  /**
   * Creates a template engine instance based on type.
   * 
   * Currently maps "mjml" to Handlebars since full MJML processing
   * requires server-side rendering. Can be extended to support true MJML.
   * 
   * @param config - Configuration with desired engine type
   * @returns Template engine instance implementing ITemplateEngine
   * 
   * @example
   * const engine = TemplateFactory.create({ type: 'handlebars' });
   * const compiled = engine.compile('<h1>Hello {{name}}</h1>');
   * const html = engine.render(compiled, { name: 'World' });
   */
  public static create(config: { type: TemplateEngineType }): ITemplateEngine {
    if (config.type === "mustache") {
      return new MustacheEngine();
    }
    // Keep mjml mapped to handlebars pipeline in this capstone version.
    return new HandlebarsEngine();
  }
}
