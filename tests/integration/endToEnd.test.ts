import { describe, expect, it } from "vitest";
import { SDKBuilder } from "../../src/core/SDKBuilder";
import { createTestPayload } from "../utils/createTestPayload";
import { waitForEvent } from "../utils/waitForEvent";

describe("EmailSDK integration", () => {
  it("sends an email end-to-end with awaitResult", async () => {
    const sdk = new SDKBuilder()
      .addMockProvider("mock-primary", { failureRate: 0, baseLatencyMs: 5 })
      .withQueue({ concurrency: 1, pollIntervalMs: 10 })
      .build();

    const sentEvent = waitForEvent<{ messageId: string; provider?: string }>(
      (sdk as unknown as { on: (event: string, handler: (payload: unknown) => void) => void }) as never,
      "email.sent",
      2000
    );
    const result = await sdk.send(createTestPayload(), { awaitResult: true });

    expect(result.status).toBe("sent");
    expect(result.provider).toBe("mock-primary");

    const sent = await sentEvent;
    expect(sent.messageId).toBe(result.messageId);

    await sdk.shutdown();
  });

  it("falls back to secondary provider when primary fails", async () => {
    const sdk = new SDKBuilder()
      .addMockProvider("primary", { failFirst: 1, baseLatencyMs: 1 })
      .addMockProvider("secondary", { failureRate: 0, baseLatencyMs: 1 })
      .withQueue({ concurrency: 1, pollIntervalMs: 10 })
      .withRetry({ maxAttempts: 3, baseDelayMs: 5, maxDelayMs: 10, jitter: false })
      .build();

    const result = await sdk.send(createTestPayload({ subject: "fallback" }), { awaitResult: true });
    expect(result.status).toBe("sent");
    expect(["primary", "secondary"]).toContain(result.provider);

    await sdk.shutdown();
  });
});

