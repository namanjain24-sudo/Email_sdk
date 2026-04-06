import { createTransport, Transporter } from "nodemailer";
import { BaseProvider } from "./BaseProvider";
import { EmailPayload } from "../types/EmailPayload";

export interface SmtpProviderConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

export class SmtpProvider extends BaseProvider {
  private readonly transporter: Transporter;

  constructor(config: SmtpProviderConfig, name = "smtp") {
    super(name);
    this.transporter = createTransport(config);
  }

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
