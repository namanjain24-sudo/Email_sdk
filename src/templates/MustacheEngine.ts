import Mustache from "mustache";
import { ITemplateEngine } from "./ITemplateEngine";

export class MustacheEngine implements ITemplateEngine<string> {
  public compile(template: string): string {
    return template;
  }

  public render(compiled: string, data: Record<string, unknown>): string {
    return Mustache.render(compiled, data);
  }
}
