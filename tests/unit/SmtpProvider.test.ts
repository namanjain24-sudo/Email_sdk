import { describe, expect, it, vi, beforeEach } from "vitest";
import { SmtpProvider } from "../../src/providers/SmtpProvider";

// ── Stub nodemailer so no live connection is made ──────────────────────────
const mockSendMail = vi.fn();
const mockVerify = vi.fn();

vi.mock("nodemailer", () => ({
  createTransport: () => ({
    sendMail: mockSendMail,
    verify: mockVerify
  })
}));

// ── helpers ────────────────────────────────────────────────────────────────

function makePayload(overrides = {}) {
  return {
    id: "msg-smtp-1",
    from: { email: "sender@example.com" },
    to: [{ email: "to@example.com" }],
    subject: "SMTP unit test",
    html: "<p>hello</p>",
    metadata: { correlationId: "corr-smtp-1" },
    ...overrides
  };
}

describe("SmtpProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Construction ──────────────────────────────────────────────────────────

  it("defaults name to 'smtp'", () => {
    const p = new SmtpProvider({ host: "localhost", port: 25 });
    expect(p.name).toBe("smtp");
  });

  it("uses the custom name when provided", () => {
    const p = new SmtpProvider({ host: "localhost", port: 25 }, "my-smtp");
    expect(p.name).toBe("my-smtp");
  });

  // ── send (doSend path) ────────────────────────────────────────────────────

  it("calls sendMail with correct fields for a simple message", async () => {
    mockSendMail.mockResolvedValue({});
    const p = new SmtpProvider({ host: "localhost", port: 25 });
    const result = await p.send(makePayload());

    expect(mockSendMail).toHaveBeenCalledOnce();
    const args = mockSendMail.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.from).toBe("sender@example.com");
    expect(args.to).toBe("to@example.com");
    expect(args.subject).toBe("SMTP unit test");
    expect(args.html).toBe("<p>hello</p>");
    expect(result.provider).toBe("smtp");
    expect(result.status).toBe("sent");
    expect(result.messageId).toBe("msg-smtp-1");
  });

  it("maps cc/bcc to comma-separated strings", async () => {
    mockSendMail.mockResolvedValue({});
    const p = new SmtpProvider({ host: "localhost", port: 25 });
    await p.send(
      makePayload({
        cc: [{ email: "cc1@x.com" }, { email: "cc2@x.com" }],
        bcc: [{ email: "bcc@x.com" }]
      })
    );
    const args = mockSendMail.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.cc).toBe("cc1@x.com,cc2@x.com");
    expect(args.bcc).toBe("bcc@x.com");
  });

  it("passes attachments through to sendMail", async () => {
    mockSendMail.mockResolvedValue({});
    const p = new SmtpProvider({ host: "localhost", port: 25 });
    await p.send(
      makePayload({
        attachments: [{ filename: "file.txt", content: "hello", contentType: "text/plain", encoding: "utf-8" }]
      })
    );
    const args = mockSendMail.mock.calls[0]![0] as Record<string, unknown>;
    const atts = args.attachments as { filename: string }[];
    expect(atts).toHaveLength(1);
    expect(atts[0]!.filename).toBe("file.txt");
  });

  it("throws a ProviderError when sendMail rejects", async () => {
    mockSendMail.mockRejectedValue(Object.assign(new Error("Connection refused"), { statusCode: 503 }));
    const p = new SmtpProvider({ host: "localhost", port: 25 });
    await expect(p.send(makePayload())).rejects.toMatchObject({
      message: "Connection refused",
      retryable: true
    });
  });

  it("throws ProviderError (non-retryable) for 400 status codes", async () => {
    mockSendMail.mockRejectedValue(Object.assign(new Error("Bad address"), { statusCode: 400 }));
    const p = new SmtpProvider({ host: "localhost", port: 25 });
    await expect(p.send(makePayload())).rejects.toMatchObject({ retryable: false });
  });

  it("throws ProviderError with missing message id", async () => {
    const p = new SmtpProvider({ host: "localhost", port: 25 });
    // payload with no id triggers the BaseProvider guard
    await expect(
      p.send({ from: { email: "a@a.com" }, to: [{ email: "b@b.com" }], subject: "s" })
    ).rejects.toMatchObject({ message: "Missing message id on payload" });
  });

  // ── healthCheck ───────────────────────────────────────────────────────────

  it("returns UP when verify succeeds quickly", async () => {
    mockVerify.mockResolvedValue(true);
    const p = new SmtpProvider({ host: "localhost", port: 25 });
    const health = await p.healthCheck();
    expect(["UP", "DEGRADED"]).toContain(health.status);
    expect(health.provider).toBe("smtp");
  });

  it("returns DOWN when verify throws", async () => {
    mockVerify.mockRejectedValue(new Error("refused"));
    const p = new SmtpProvider({ host: "localhost", port: 25 });
    const health = await p.healthCheck();
    expect(health.status).toBe("DOWN");
    expect(health.provider).toBe("smtp");
  });
});
