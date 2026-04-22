import Mustache from "mustache";
import { ITemplateEngine } from "./ITemplateEngine";

export class MustacheEngine implements ITemplateEngine<string> {
  public compile(template: string): string {
    return template;
  }

  public compileTyped<TSchema extends Record<string, unknown>>(template: string): (data: TSchema) => string {
    return (data: TSchema): string => Mustache.render(template, data);
  }

  public render(compiled: string, data: Record<string, unknown>): string {
    return Mustache.render(compiled, data);
  }
}
