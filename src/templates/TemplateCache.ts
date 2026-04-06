export class TemplateCache<TCompiled> {
  private readonly cache = new Map<string, TCompiled>();

  constructor(private readonly maxSize = 100) {}

  public get(id: string): TCompiled | undefined {
    const existing = this.cache.get(id);
    if (!existing) {
      return undefined;
    }
    this.cache.delete(id);
    this.cache.set(id, existing);
    return existing;
  }

  public set(id: string, value: TCompiled): void {
    if (this.cache.has(id)) {
      this.cache.delete(id);
    }
    this.cache.set(id, value);
    if (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) {
        this.cache.delete(oldest);
      }
    }
  }
}
