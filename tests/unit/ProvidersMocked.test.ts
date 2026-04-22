import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Hoist spy factories so they work inside vi.mock factories ─────────────────
const { sgSend, sgRequest, sesSend } = vi.hoisted(() => ({
  sgSend: vi.fn(),
  sgRequest: vi.fn(),
  sesSend: vi.fn()
}));

// ── SendGrid mock ─────────────────────────────────────────────────────────────
vi.mock("@sendgrid/mail", () => ({
  default: {
    setApiKey: vi.fn(),
    send: sgSend,
    request: sgRequest
  }
}));

// ── AWS SES mock ──────────────────────────────────────────────────────────────
vi.mock("@aws-sdk/client-ses", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-ses")>();
  return {
    ...actual,
    SESClient: vi.fn().mockImplementation(() => ({ send: sesSend }))
  };
});

// Import providers AFTER mocks are declared
import { SendGridProvider } from "../../src/providers/SendGridProvider";
import { AwsSesProvider } from "../../src/providers/AwsSesProvider";

// ── helpers ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    from: { email: "from@example.com" },
    to: [{ email: "to@example.com" }],
    subject: "Test",
    html: "<p>hi</p>",
    metadata: { correlationId: "corr-1" },
    ...overrides
  };
}

// ── SendGridProvider ──────────────────────────────────────────────────────────

describe("SendGridProvider (mocked)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends email via sendgrid.send and returns SENT result", async () => {
    sgSend.mockResolvedValue([{ statusCode: 202 }, {}]);
    const p = new SendGridProvider({ apiKey: "SG.test" });
    const result = await p.send(makePayload());
    expect(sgSend).toHaveBeenCalledOnce();
    expect(result.status).toBe("sent");
    expect(result.provider).toBe("sendgrid");
  });

  it("maps cc/bcc and attachments correctly", async () => {
    sgSend.mockResolvedValue([{ statusCode: 202 }, {}]);
    const p = new SendGridProvider({ apiKey: "SG.test" });
    await p.send(
      makePayload({
        cc: [{ email: "cc@x.com" }],
        bcc: [{ email: "bcc@x.com" }],
        text: "plain",
        attachments: [{ filename: "a.txt", content: "hello", contentType: "text/plain", encoding: "utf-8" }]
      })
    );
    const args = sgSend.mock.calls[0]![0] as Record<string, unknown>;
    expect((args.cc as string[])[0]).toBe("cc@x.com");
    expect((args.bcc as string[])[0]).toBe("bcc@x.com");
    const atts = args.attachments as { filename: string }[];
    expect(atts[0]!.filename).toBe("a.txt");
  });

  it("converts buffer attachment content to base64", async () => {
    sgSend.mockResolvedValue([{ statusCode: 202 }, {}]);
    const p = new SendGridProvider({ apiKey: "SG.test" });
    await p.send(
      makePayload({
        attachments: [{ filename: "f.bin", content: Buffer.from("data"), contentType: "application/octet-stream" }]
      })
    );
    const atts = (sgSend.mock.calls[0]![0] as Record<string, unknown[]>).attachments as { content: string }[];
    expect(atts[0]!.content).toBe(Buffer.from("data").toString("base64"));
  });

  it("throws ProviderError when sendgrid.send rejects", async () => {
    sgSend.mockRejectedValue(Object.assign(new Error("Unauthorized"), { statusCode: 401 }));
    const p = new SendGridProvider({ apiKey: "bad-key" });
    await expect(p.send(makePayload())).rejects.toMatchObject({
      retryable: false,
      message: "Unauthorized"
    });
  });

  it("healthCheck returns UP when request succeeds quickly", async () => {
    sgRequest.mockResolvedValue([{ statusCode: 200 }, {}]);
    const p = new SendGridProvider({ apiKey: "SG.test" });
    const h = await p.healthCheck();
    expect(["UP", "DEGRADED"]).toContain(h.status);
  });

  it("healthCheck returns DOWN when request throws", async () => {
    sgRequest.mockRejectedValue(new Error("network"));
    const p = new SendGridProvider({ apiKey: "SG.test" });
    const h = await p.healthCheck();
    expect(h.status).toBe("DOWN");
  });

  it("uses custom provider name", () => {
    const p = new SendGridProvider({ apiKey: "SG.test" }, "my-sg");
    expect(p.name).toBe("my-sg");
  });
});

// ── AwsSesProvider ────────────────────────────────────────────────────────────

describe("AwsSesProvider (mocked)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a plain email via SendEmailCommand", async () => {
    sesSend.mockResolvedValue({ MessageId: "ses-msg-1" });
    const p = new AwsSesProvider({ region: "us-east-1" });
    const result = await p.send(makePayload());
    expect(sesSend).toHaveBeenCalledOnce();
    expect(result.status).toBe("sent");
    expect(result.provider).toBe("ses");
  });

  it("sends via SendRawEmailCommand when attachments are present", async () => {
    sesSend.mockResolvedValue({});
    const p = new AwsSesProvider({ region: "us-east-1" });
    await p.send(
      makePayload({
        text: "plain",
        attachments: [{ filename: "doc.pdf", content: "pdf-bytes", contentType: "application/pdf", encoding: "utf-8" }]
      })
    );
    expect(sesSend).toHaveBeenCalledOnce();
  });

  it("throws ProviderError when SES send rejects", async () => {
    sesSend.mockRejectedValue(Object.assign(new Error("throttled"), { statusCode: 429 }));
    const p = new AwsSesProvider({ region: "us-east-1" });
    await expect(p.send(makePayload())).rejects.toMatchObject({ retryable: true });
  });

  it("healthCheck returns UP when GetSendQuotaCommand succeeds", async () => {
    sesSend.mockResolvedValue({ Max24HourSend: 200 });
    const p = new AwsSesProvider({ region: "us-east-1" });
    const h = await p.healthCheck();
    expect(["UP", "DEGRADED"]).toContain(h.status);
  });

  it("healthCheck returns DOWN when GetSendQuotaCommand throws", async () => {
    sesSend.mockRejectedValue(new Error("no credentials"));
    const p = new AwsSesProvider({ region: "us-east-1" });
    const h = await p.healthCheck();
    expect(h.status).toBe("DOWN");
  });

  it("accepts explicit accessKeyId/secretAccessKey credentials", async () => {
    sesSend.mockResolvedValue({});
    const p = new AwsSesProvider({
      region: "eu-west-1",
      accessKeyId: "AKIA_FAKE",
      secretAccessKey: "fake-secret"
    });
    await p.send(makePayload());
    expect(sesSend).toHaveBeenCalledOnce();
  });

  it("uses custom provider name", () => {
    const p = new AwsSesProvider({ region: "us-east-1" }, "my-ses");
    expect(p.name).toBe("my-ses");
  });
});
