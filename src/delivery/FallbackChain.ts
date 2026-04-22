import { IEmailProvider } from "../providers/IEmailProvider";
import { CircuitBreaker } from "./CircuitBreaker";

export class FallbackChain {
  constructor(
    private readonly providers: IEmailProvider[],
    private readonly breakers: Map<string, CircuitBreaker>
  ) {}

  public orderedAvailable(): IEmailProvider[] {
    return this.providers.filter((provider) => {
      const breaker = this.breakers.get(provider.name);
      return !(breaker?.isOpen() ?? false) && provider.isAvailable();
    });
  }
}
