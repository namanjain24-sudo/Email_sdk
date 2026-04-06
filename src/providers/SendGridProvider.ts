import sendgrid from "@sendgrid/mail";
import { BaseProvider } from "./BaseProvider";
import { EmailPayload } from "../types/EmailPayload";

export interface SendGridProviderConfig {
  apiKey: string;
}

export class SendGridProvider extends BaseProvider {
  constructor(config: SendGridProviderConfig, name = "sendgrid") {
    super(name);
    sendgrid.setApiKey(config.apiKey);
  }

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
