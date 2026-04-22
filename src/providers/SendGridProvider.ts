import sendgrid from "@sendgrid/mail";
import { BaseProvider } from "./BaseProvider";
import { Attachment, EmailPayload } from "../types/EmailPayload";
import { ProviderHealth } from "../types/ProviderHealth";

export interface SendGridProviderConfig {
  apiKey: string;
}

export class SendGridProvider extends BaseProvider {
  constructor(config: SendGridProviderConfig, name = "sendgrid") {
    super(name);
    sendgrid.setApiKey(config.apiKey);
  }

  public override async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      // Lightweight authenticated request; doesn't send email.
      await (sendgrid as unknown as { request: (args: unknown) => Promise<unknown> }).request({
        method: "GET",
        url: "/v3/user/account"
      });
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

  protected async doSend(payload: EmailPayload): Promise<void> {
    await sendgrid.send({
      from: payload.from.email,
      to: payload.to.map((x) => x.email),
      cc: payload.cc?.map((x) => x.email),
      bcc: payload.bcc?.map((x) => x.email),
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html ?? "",
      attachments: payload.attachments?.map((a: Attachment) => ({
        filename: a.filename,
        type: a.contentType,
        disposition: "attachment",
        content:
          Buffer.isBuffer(a.content)
            ? a.content.toString("base64")
            : a.encoding === "base64"
              ? a.content
              : Buffer.from(a.content, "utf-8").toString("base64")
      }))
    });
  }
}
