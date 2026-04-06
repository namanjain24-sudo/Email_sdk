import { EmailPayload } from "../types/EmailPayload";
import { ProviderHealth } from "../types/ProviderHealth";
import { SendResult } from "../types/SendResult";

export interface IEmailProvider {
  readonly name: string;
  send(payload: EmailPayload): Promise<SendResult>;
  healthCheck(): Promise<ProviderHealth>;
  isAvailable(): boolean;
}
