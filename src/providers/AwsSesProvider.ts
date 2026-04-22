import { GetSendQuotaCommand, SendEmailCommand, SendRawEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { BaseProvider } from "./BaseProvider";
import { EmailPayload } from "../types/EmailPayload";
import { ProviderHealth } from "../types/ProviderHealth";

export interface AwsSesProviderConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class AwsSesProvider extends BaseProvider {
  private readonly client: SESClient;

  constructor(config: AwsSesProviderConfig, name = "ses") {
    super(name);
    this.client = new SESClient({
      region: config.region,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey
            }
          : undefined
    });
  }

  public override async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      await this.client.send(new GetSendQuotaCommand({}));
      const latencyMs = Date.now() - started;
      return {
        provider: this.name,
        status: latencyMs > 1500 ? "DEGRADED" : "UP",
        latencyMs,
        checkedAt: new Date()
      };
    } catch {
      return { provider: this.name, status: "DOWN", checkedAt: new Date() };
    }
  }

  protected async doSend(payload: EmailPayload): Promise<void> {
    if (payload.attachments && payload.attachments.length > 0) {
      const raw = AwsSesProvider.buildRawMime(payload);
      const command = new SendRawEmailCommand({
        Source: payload.from.email,
        Destinations: payload.to.map((x) => x.email),
        RawMessage: { Data: raw }
      });
      await this.client.send(command);
      return;
    }

    const command = new SendEmailCommand({
      Source: payload.from.email,
      Destination: {
        ToAddresses: payload.to.map((x) => x.email),
        CcAddresses: payload.cc?.map((x) => x.email),
        BccAddresses: payload.bcc?.map((x) => x.email)
      },
      Message: {
        Subject: { Data: payload.subject },
        Body: {
          Html: payload.html ? { Data: payload.html } : undefined,
          Text: payload.text ? { Data: payload.text } : undefined
        }
      }
    });
    await this.client.send(command);
  }

  private static buildRawMime(payload: EmailPayload): Uint8Array {
    const boundary = `mixed_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const to = payload.to.map((x) => x.email).join(", ");
    const cc = payload.cc?.map((x) => x.email).join(", ");
    const bcc = payload.bcc?.map((x) => x.email).join(", ");

    const headers: string[] = [
      `From: ${payload.from.email}`,
      `To: ${to}`,
      cc ? `Cc: ${cc}` : "",
      bcc ? `Bcc: ${bcc}` : "",
      `Subject: ${payload.subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`
    ].filter(Boolean);

    const parts: string[] = [];

    const bodyText = payload.text ?? "";
    const bodyHtml = payload.html ?? "";
    const hasHtml = Boolean(payload.html);
    const hasText = Boolean(payload.text);

    if (hasHtml && hasText) {
      const altBoundary = `alt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      parts.push(
        `--${boundary}\r\nContent-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n` +
          `--${altBoundary}\r\nContent-Type: text/plain; charset="utf-8"\r\nContent-Transfer-Encoding: 7bit\r\n\r\n${bodyText}\r\n\r\n` +
          `--${altBoundary}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: 7bit\r\n\r\n${bodyHtml}\r\n\r\n` +
          `--${altBoundary}--\r\n`
      );
    } else {
      const contentType = hasHtml ? 'text/html; charset="utf-8"' : 'text/plain; charset="utf-8"';
      const body = hasHtml ? bodyHtml : bodyText;
      parts.push(
        `--${boundary}\r\nContent-Type: ${contentType}\r\nContent-Transfer-Encoding: 7bit\r\n\r\n${body}\r\n`
      );
    }

    for (const a of payload.attachments ?? []) {
      const contentBase64 =
        Buffer.isBuffer(a.content)
          ? a.content.toString("base64")
          : a.encoding === "base64"
            ? a.content
            : Buffer.from(a.content, "utf-8").toString("base64");

      parts.push(
        `--${boundary}\r\n` +
          `Content-Type: ${a.contentType}; name="${a.filename}"\r\n` +
          "Content-Transfer-Encoding: base64\r\n" +
          `Content-Disposition: attachment; filename="${a.filename}"\r\n\r\n` +
          `${contentBase64}\r\n`
      );
    }

    parts.push(`--${boundary}--\r\n`);

    const raw = `${headers.join("\r\n")}\r\n\r\n${parts.join("")}`;
    return new TextEncoder().encode(raw);
  }
}
