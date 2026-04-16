import { createTransport, Transporter } from "nodemailer";
import { BaseProvider } from "./BaseProvider";
import { EmailPayload } from "../types/EmailPayload";

/**
 * SmtpProviderConfig - Configuration for SMTP email provider.
 * 
 * Specifies SMTP server connection details and authentication.
 */
export interface SmtpProviderConfig {
  /** SMTP server hostname or IP */
  host: string;
  /** SMTP server port (typically 25, 465, or 587) */
  port: number;
  /** Use TLS for secure connection (default: based on port) */
  secure?: boolean;
  /** Optional authentication credentials */
  auth?: {
    /** SMTP username */
    user: string;
    /** SMTP password */
    pass: string;
  };
}

/**
 * SmtpProvider - Email provider using standard SMTP protocol.
 * 
 * Integrates with any SMTP-compatible server through the Nodemailer library.
 * Useful for:
 * - On-premise email servers
 * - Local development/testing
 * - Hybrid deployments with multiple providers
 */
export class SmtpProvider extends BaseProvider {
  private readonly transporter: Transporter;

  /**
   * Constructs an SmtpProvider with SMTP connection details.
   * 
   * Creates a Nodemailer transporter configured with provided SMTP settings.
   * 
   * @param config - SMTP server configuration
   * @param name - Optional provider name (default: "smtp")
   */
  constructor(config: SmtpProviderConfig, name = "smtp") {
    super(name);
    this.transporter = createTransport(config);
  }

  /**
   * Sends an email through the SMTP server.
   * 
   * Formats email payload into Nodemailer message and sends via SMTP.
   * 
   * @param payload - Email payload with recipient, subject, and content
   * @param messageId - Unique message ID for this send attempt
   * @throws Error if SMTP connection fails or server rejects email
   */
  protected async doSend(payload: EmailPayload, messageId: string): Promise<void> {
    await this.transporter.sendMail({
      messageId,
      from: payload.from.email,
      to: payload.to.map((r) => r.email).join(","),
      cc: payload.cc?.map((r) => r.email).join(","),
      bcc: payload.bcc?.map((r) => r.email).join(","),
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    });
  }
}
