export interface ITemplateEngine<TCompiled = unknown> {
  compile(template: string): TCompiled;
  render(compiled: TCompiled, data: Record<string, unknown>): string;
}
