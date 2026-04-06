import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { BaseProvider } from "./BaseProvider";
import { EmailPayload } from "../types/EmailPayload";

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

  protected async doSend(payload: EmailPayload): Promise<void> {
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
}
