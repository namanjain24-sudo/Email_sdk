import { ProviderConfig } from "../types/SDKConfig";
import { IEmailProvider } from "./IEmailProvider";
import { SmtpProvider, SmtpProviderConfig } from "./SmtpProvider";
import { AwsSesProvider, AwsSesProviderConfig } from "./AwsSesProvider";
import { SendGridProvider, SendGridProviderConfig } from "./SendGridProvider";
import { MockProvider, MockProviderOptions } from "./MockProvider";

export class EmailProviderFactory {
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
