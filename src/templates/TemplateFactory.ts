import { HandlebarsEngine } from "./HandlebarsEngine";
import { ITemplateEngine } from "./ITemplateEngine";
import { MustacheEngine } from "./MustacheEngine";

export type TemplateEngineType = "handlebars" | "mustache";

export class TemplateFactory {
  public static create(config: { type: TemplateEngineType }): ITemplateEngine {
    if (config.type === "mustache") {
      return new MustacheEngine();
    }
    return new HandlebarsEngine();
  }
}
