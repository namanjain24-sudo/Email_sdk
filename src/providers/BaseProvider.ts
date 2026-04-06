import { EmailPayload } from "../types/EmailPayload";
import { EmailStatus } from "../types/EmailStatus";
import { ProviderHealth } from "../types/ProviderHealth";
import { SendResult } from "../types/SendResult";

export abstract class BaseProvider {
  constructor(public readonly name: string) {}

  public async send(payload: EmailPayload): Promise<SendResult> {
    const startedAt = Date.now();
    const messageId = payload.id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await this.doSend(payload, messageId);
    return {
      messageId,
      provider: this.name,
      status: EmailStatus.SENT,
      attempts: 1,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date()
    };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: this.name,
      status: "UP",
      checkedAt: new Date()
    };
  }

  public isAvailable(): boolean {
    return true;
  }

  protected abstract doSend(payload: EmailPayload, messageId: string): Promise<void>;
}
