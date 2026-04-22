import { describe, expect, it } from "vitest";
import { EmailEventEmitter } from "../../src/events/EmailEventEmitter";
import { DLQHandler } from "../../src/queue/DLQHandler";
import { EmailStatus } from "../../src/types/EmailStatus";

describe("Observability helpers", () => {
  it("EmailEventEmitter emits typed events", () => {
    const emitter = new EmailEventEmitter();
    let called = false;
    emitter.on("email.queued", () => {
      called = true;
    });
    emitter.emitQueued({
      messageId: "m1",
      correlationId: "c1",
      status: "queued",
      timestamp: new Date().toISOString()
    });
    expect(called).toBe(true);
  });

  it("DLQHandler stores failed jobs", () => {
    const dlq = new DLQHandler();
    dlq.add({
      id: "m1",
      correlationId: "c1",
      payload: { from: { email: "a@a.com" }, to: [{ email: "b@b.com" }], subject: "s" },
      attempts: 1,
      enqueuedAt: new Date(),
      nextRetryAt: Date.now(),
      status: EmailStatus.DLQ
    });
    expect(dlq.list().length).toBe(1);
  });
});

