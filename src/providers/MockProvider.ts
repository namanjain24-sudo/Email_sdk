import { BaseProvider } from "./BaseProvider";
import { EmailPayload } from "../types/EmailPayload";

export interface MockProviderOptions {
  failureRate?: number;
  baseLatencyMs?: number;
}

export class MockProvider extends BaseProvider {
  private readonly failureRate: number;
  private readonly baseLatencyMs: number;

  constructor(name = "mock", options: MockProviderOptions = {}) {
    super(name);
    this.failureRate = options.failureRate ?? 0;
    this.baseLatencyMs = options.baseLatencyMs ?? 30;
  }

  protected async doSend(payload: EmailPayload, messageId: string): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, this.baseLatencyMs));
    const fail = Math.random() < this.failureRate;
    if (fail) {
      const error = new Error(`Mock provider ${this.name} simulated failure`);
      (error as { code?: number }).code = 503;
      throw error;
    }
    void payload;
    void messageId;
  }
}
