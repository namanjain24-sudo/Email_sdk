import { IEmailProvider } from "../providers/IEmailProvider";
import { ProviderHealth } from "../types/ProviderHealth";

export class HealthChecker {
  constructor(private readonly providers: IEmailProvider[]) {}

  public async check(): Promise<ProviderHealth[]> {
    return Promise.all(this.providers.map((provider) => provider.healthCheck()));
  }
}
