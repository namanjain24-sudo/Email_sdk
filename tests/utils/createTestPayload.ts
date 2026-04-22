import { EmailPayload } from "../../src/types/EmailPayload";

export function createTestPayload(overrides: Partial<EmailPayload> = {}): EmailPayload {
  return {
    from: { email: "no-reply@example.com" },
    to: [{ email: "user@example.com" }],
    subject: "Test",
    html: "<h1>Test</h1>",
    ...overrides
  };
}

