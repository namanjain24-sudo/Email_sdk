import Handlebars, { TemplateDelegate } from "handlebars";
import { ITemplateEngine } from "./ITemplateEngine";

export class HandlebarsEngine implements ITemplateEngine<TemplateDelegate> {
  public compile(template: string): TemplateDelegate {
    return Handlebars.compile(template);
  }

  public compileTyped<TSchema extends Record<string, unknown>>(
    template: string
  ): (data: TSchema) => string {
    const compiled = Handlebars.compile(template);
    return (data: TSchema): string => compiled(data);
  }

  public render(compiled: TemplateDelegate, data: Record<string, unknown>): string {
    return compiled(data);
  }
}
