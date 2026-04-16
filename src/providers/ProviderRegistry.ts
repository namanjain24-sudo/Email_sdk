import { IEmailProvider } from "./IEmailProvider";

/**
 * ProviderRegistry - Central registry for email providers.
 * 
 * Stores and manages provider instances by name.
 * Allows lookup of providers for monitoring, configuration, and administration.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, IEmailProvider>();

  /**
   * Registers a provider in the registry.
   * 
   * @param provider - Provider to register (keyed by provider.name)
   */
  public register(provider: IEmailProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Retrieves a registered provider by name.
   * 
   * @param name - Provider name  
   * @returns Provider instance, or undefined if not registered
   */
  public get(name: string): IEmailProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Returns all registered providers as an array.
   * 
   * @returns List of all providers in registry
   */
  public list(): IEmailProvider[] {
    return [...this.providers.values()];
  }
}
