import sendgrid from "@sendgrid/mail";
import { BaseProvider } from "./BaseProvider";
import { EmailPayload } from "../types/EmailPayload";

/**
 * SendGridProviderConfig - Configuration for SendGrid email provider.
 * 
 * Requires an API key for authentication with SendGrid service.
 */
export interface SendGridProviderConfig {
  /** SendGrid API key for authentication */
  apiKey: string;
}

/**
 * SendGridProvider - Email provider using SendGrid's Mail Send API.
 * 
 * Features:
 * - Highly reliable email delivery
 * - Web UI for templates and campaign management
 * - Detailed analytics and monitoring
 * - Good SLA and deliverability
 * - Global mail server infrastructure
 */
export class SendGridProvider extends BaseProvider {
  /**
   * Constructs a SendGridProvider with API authentication.
   * 
   * Sets SendGrid global API key for all future requests.
   * 
   * @param config - SendGrid configuration with API key
   * @param name - Optional provider name (default: "sendgrid")
   */
  constructor(config: SendGridProviderConfig, name = "sendgrid") {
    super(name);
    sendgrid.setApiKey(config.apiKey);
  }

  /**
   * Sends an email through SendGrid.
   * 
   * Formats payload into SendGrid mail message and sends via API.
   * Falls back to HTML as text if text content not provided.
   * 
   * @param payload - Email payload with recipients, subject, and content
   * @throws Error if SendGrid API returns error (auth, invalid recipient, etc.)
   */
  protected async doSend(payload: EmailPayload): Promise<void> {
    await sendgrid.send({
      from: payload.from.email,
      to: payload.to.map((x) => x.email),
      cc: payload.cc?.map((x) => x.email),
      bcc: payload.bcc?.map((x) => x.email),
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html ?? ""
    });
  }
}
