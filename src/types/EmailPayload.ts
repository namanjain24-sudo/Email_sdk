export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EmailPayload {
  id?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  priority?: "high" | "normal" | "low";
  metadata?: Record<string, string>;
}
