export type EmailEventName =
  | "email.queued"
  | "email.sent"
  | "email.failed"
  | "email.retrying";

export interface EmailEventPayload {
  messageId: string;
  correlationId: string;
  provider?: string;
  status: string;
  attempt?: number;
  delayMs?: number;
  latencyMs?: number;
  reason?: string;
  timestamp: string;
}
