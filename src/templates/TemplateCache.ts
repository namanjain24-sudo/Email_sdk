/**
 * TemplateCache - LRU (Least Recently Used) cache for compiled templates.
 * 
 * Stores precompiled templates to avoid recompiling on each use.
 * Implements LRU eviction - when max size is reached, the oldest
 * unused template is removed.
 * 
 * Generic over compiled template type (TemplateDelegate for Handlebars, string for Mustache).
 */
export class TemplateCache<TCompiled> {
  private readonly cache = new Map<string, TCompiled>();

  /**
   * Constructs a TemplateCache with specified maximum size.
   * 
   * @param maxSize - Maximum number of templates to cache (default: 100)
   */
  constructor(private readonly maxSize = 100) {}

  /**
   * Retrieves a compiled template from cache.
   * 
   * If found, moves the template to the end (marks as recently used)
   * to implement LRU ordering.
   * 
   * @param id - Template ID to retrieve
   * @returns Compiled template, or undefined if not in cache
   */
  public get(id: string): TCompiled | undefined {
    const existing = this.cache.get(id);
    if (!existing) {
      return undefined;
    }
    this.cache.delete(id);
    this.cache.set(id, existing);
    return existing;
  }

  /**
   * Stores a compiled template in the cache.
   * 
   * If template already exists, removes old version first.
   * If cache is at max size, evicts the least recently used (oldest) entry.
   * 
   * @param id - Template ID
   * @param value - Compiled template to cache
   */
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
