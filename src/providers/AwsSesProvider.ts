import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { BaseProvider } from "./BaseProvider";
import { EmailPayload } from "../types/EmailPayload";

/**
 * AwsSesProviderConfig - Configuration for AWS SES email provider.
 * 
 * Specifies AWS region and optional credentials (or uses IAM role).
 */
export interface AwsSesProviderConfig {
  /** AWS region for SES (e.g., "us-east-1") */
  region: string;
  /** Optional AWS Access Key ID (uses IAM role if not provided) */
  accessKeyId?: string;
  /** Optional AWS Secret Access Key */
  secretAccessKey?: string;
}

/**
 * AwsSesProvider - Email provider using Amazon SES (Simple Email Service).
 * 
 * Features:
 * - High-volume email sending from AWS
 * - Integrated reputation monitoring and bounce handling
 * - Can use IAM roles for authentication
 * - Better for AWS-hosted applications
 */
export class AwsSesProvider extends BaseProvider {
  private readonly client: SESClient;

  /**
   * Constructs an AwsSesProvider with AWS SES credentials.
   * 
   * If no credentials provided, uses IAM role attached to EC2/Lambda execution.
   * 
   * @param config - AWS SES configuration with region and optional credentials
   * @param name - Optional provider name (default: "ses")
   */
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

  /**
   * Sends an email through AWS SES.
   * 
   * Formats payload into SendEmailCommand and sends via SES API.
   * Constructs destination addresses for To, CC, and BCC fields.
   * 
   * @param payload - Email payload with recipients and content
   * @throws Error if SES returns error (invalid sender, throttling, etc.)
   */
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
