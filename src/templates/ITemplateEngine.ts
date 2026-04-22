export interface ITemplateEngine<TCompiled = unknown> {
  compile(template: string): TCompiled;
  compileTyped<TSchema extends Record<string, unknown>>(template: string): (data: TSchema) => string;
  render(compiled: TCompiled, data: Record<string, unknown>): string;
}
