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
  attachments?: Attachment[];
  priority?: "high" | "normal" | "low";
  metadata?: Record<string, string>;
}

export interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  encoding?: "base64" | "utf-8";
}
