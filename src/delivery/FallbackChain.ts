import { IEmailProvider } from "../providers/IEmailProvider";
import { CircuitBreaker } from "./CircuitBreaker";

/**
 * FallbackChain - Manages ordered provider fallback for redundancy.
 * 
 * When the primary provider fails, the SDK automatically tries the next
 * provider in the chain. Also respects circuit breaker state - skips
 * providers that are in OPEN state.
 * 
 * Supports both sequential (nextAvailable) and batch (orderedAvailable) lookups.
 */
export class FallbackChain {
  /**
   * Constructs a FallbackChain with ordered providers.
   * 
   * @param providers - Providers in priority order (first = highest priority)
   * @param breakers - Circuit breakers for each provider
   */
  constructor(
    private readonly providers: IEmailProvider[],
    private readonly breakers: Map<string, CircuitBreaker>
  ) {}

  /**
   * Gets the next available provider in the chain.
   * 
   * Returns the first provider that is:
   * - Not blocked by an open circuit breaker
   * - Marked as available by the provider
   * 
   * @returns Next available provider, or null if none are available
   */
  public nextAvailable(): IEmailProvider | null {
    for (const provider of this.providers) {
      const breaker = this.breakers.get(provider.name);
      const blocked = breaker?.isOpen() ?? false;
      if (!blocked && provider.isAvailable()) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Gets all available providers in order.
   * 
   * Returns providers that are not blocked by open circuit breakers
   * and are marked as available, in their configuration order.
   * 
   * @returns Array of available providers (may be empty)
   */
  public orderedAvailable(): IEmailProvider[] {
    return this.providers.filter((provider) => {
      const breaker = this.breakers.get(provider.name);
      return !(breaker?.isOpen() ?? false) && provider.isAvailable();
    });
  }
}
