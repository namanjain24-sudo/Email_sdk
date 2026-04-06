import { IEmailProvider } from "../providers/IEmailProvider";
import { CircuitBreaker } from "./CircuitBreaker";

export class FallbackChain {
  constructor(
    private readonly providers: IEmailProvider[],
    private readonly breakers: Map<string, CircuitBreaker>
  ) {}

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

  public orderedAvailable(): IEmailProvider[] {
    return this.providers.filter((provider) => {
      const breaker = this.breakers.get(provider.name);
      return !(breaker?.isOpen() ?? false) && provider.isAvailable();
    });
  }
}
