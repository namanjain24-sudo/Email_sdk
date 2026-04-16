import { ProviderConfig } from "../types/SDKConfig";
import { IEmailProvider } from "./IEmailProvider";
import { SmtpProvider, SmtpProviderConfig } from "./SmtpProvider";
import { AwsSesProvider, AwsSesProviderConfig } from "./AwsSesProvider";
import { SendGridProvider, SendGridProviderConfig } from "./SendGridProvider";
import { MockProvider, MockProviderOptions } from "./MockProvider";

/**
 * EmailProviderFactory - Factory pattern for creating email provider instances.
 * 
 * Decouples provider creation from consumer code. Handles type-based
 * instantiation and configuration routing for all supported providers.
 * 
 * Supported provider types:
 * - "smtp": SMTP for standard email sending
 * - "ses": AWS SES for AWS-integrated sending
 * - "sendgrid": SendGrid API for reliable delivery
 * - "mock": Mock provider for testing
 */
export class EmailProviderFactory {
  /**
   * Creates a provider instance based on configuration.
   * 
   * Routes to appropriate provider class constructor with type-cast
   * configuration. Defaults to MockProvider for unknown types.
   * 
   * @param config - Provider configuration including type and options
   * @returns Instantiated provider implementing IEmailProvider
   * 
   * @example
   * const provider = EmailProviderFactory.create({
   *   type: 'sendgrid',
   *   options: { apiKey: 'sg_...' },
   *   name: 'sendgrid-main'
   * });
   */
  public static create(config: ProviderConfig): IEmailProvider {
    switch (config.type) {
      case "smtp":
        return new SmtpProvider(config.options as unknown as SmtpProviderConfig, config.name);
      case "ses":
        return new AwsSesProvider(config.options as unknown as AwsSesProviderConfig, config.name);
      case "sendgrid":
        return new SendGridProvider(config.options as unknown as SendGridProviderConfig, config.name);
      case "mock":
      default:
        return new MockProvider(config.name ?? "mock", config.options as unknown as MockProviderOptions);
    }
  }
}
