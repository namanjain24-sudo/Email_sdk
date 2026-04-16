/**
 * EmailAddress - Structured email address with optional display name.
 * 
 * Used for sender and recipient specification.
 */
export interface EmailAddress {
  /** Optional display name (e.g., "John Doe") */
  name?: string;
  /** Email address (e.g., "john@example.com") */
  email: string;
}

/**
 * EmailPayload - Complete email message specification.
 * 
 * Contains all information needed to send an email:
 * - Recipients and sender
 * - Subject and content (HTML and/or plain text)
 * - Template references and data
 * - Priority and metadata
 */
export interface EmailPayload {
  /** Optional unique message ID (generated if not provided) */
  id?: string;
  /** Sender email address */
  from: EmailAddress;
  /** Recipient email addresses (to) */
  to: EmailAddress[];
  /** Optional CC recipients */
  cc?: EmailAddress[];
  /** Optional BCC recipients (hidden copy) */
  bcc?: EmailAddress[];
  /** Email subject line */
  subject: string;
  /** Email body in HTML format */
  html?: string;
  /** Email body in plain text format */
  text?: string;
  /** Optional ID of precompiled template to use */
  templateId?: string;
  /** Data for template variable substitution */
  templateData?: Record<string, unknown>;
  /** Email priority: "high" (sent immediately), "normal", or "low" (queued) */
  priority?: "high" | "normal" | "low";
  /** Optional metadata for tracking (not sent to provider) */
  metadata?: Record<string, string>;
}
