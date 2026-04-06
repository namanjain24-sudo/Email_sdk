import { EmailStatus } from "./EmailStatus";

export interface SendResult {
  messageId: string;
  provider: string;
  status: EmailStatus;
  attempts: number;
  latencyMs: number;
  timestamp: Date;
  error?: string;
}
