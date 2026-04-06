import { HandlebarsEngine } from "./HandlebarsEngine";
import { ITemplateEngine } from "./ITemplateEngine";
import { MustacheEngine } from "./MustacheEngine";

export type TemplateEngineType = "handlebars" | "mustache" | "mjml";

export class TemplateFactory {
  public static create(config: { type: TemplateEngineType }): ITemplateEngine {
    if (config.type === "mustache") {
      return new MustacheEngine();
    }
    // Keep mjml mapped to handlebars pipeline in this capstone version.
    return new HandlebarsEngine();
  }
}
