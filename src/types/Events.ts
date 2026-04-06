export type EmailEventName =
  | "email.queued"
  | "email.sent"
  | "email.failed"
  | "email.retrying"
  | "email.bounced";

export interface EmailEventPayload {
  messageId: string;
  correlationId: string;
  provider?: string;
  status: string;
  attempt?: number;
  delayMs?: number;
  reason?: string;
  timestamp: string;
}
