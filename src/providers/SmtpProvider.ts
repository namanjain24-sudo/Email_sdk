import { createTransport, Transporter } from "nodemailer";
import { BaseProvider } from "./BaseProvider";
import { Attachment, EmailPayload } from "../types/EmailPayload";

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

  public override async healthCheck(): Promise<{ provider: string; status: "UP" | "DOWN" | "DEGRADED"; latencyMs?: number; checkedAt: Date }> {
    const started = Date.now();
    try {
      await this.transporter.verify();
      const latencyMs = Date.now() - started;
      return {
        provider: this.name,
        status: latencyMs > 1000 ? "DEGRADED" : "UP",
        latencyMs,
        checkedAt: new Date()
      };
    } catch {
      return { provider: this.name, status: "DOWN", checkedAt: new Date() };
    }
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
      text: payload.text,
      attachments: payload.attachments?.map((a: Attachment) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
        encoding: a.encoding
      }))
    });
  }
}
