import { IEmailProvider } from "./IEmailProvider";

export class ProviderRegistry {
  private readonly providers = new Map<string, IEmailProvider>();

  public register(provider: IEmailProvider): void {
    this.providers.set(provider.name, provider);
  }

  public get(name: string): IEmailProvider | undefined {
    return this.providers.get(name);
  }

  public list(): IEmailProvider[] {
    return [...this.providers.values()];
  }
}
