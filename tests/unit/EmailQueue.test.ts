import { describe, expect, it } from "vitest";
import { EmailQueue } from "../../src/queue/EmailQueue";
import { EmailStatus } from "../../src/types/EmailStatus";

describe("EmailQueue", () => {
  it("dequeues by priority", async () => {
    const q = new EmailQueue(10);
    await q.enqueue({
      id: "1",
      correlationId: "c1",
      payload: {
        from: { email: "a@a.com" },
        to: [{ email: "b@b.com" }],
        subject: "normal",
        priority: "normal"
      },
      attempts: 0,
      enqueuedAt: new Date(),
      nextRetryAt: Date.now(),
      status: EmailStatus.QUEUED
    });
    await q.enqueue({
      id: "2",
      correlationId: "c2",
      payload: {
        from: { email: "a@a.com" },
        to: [{ email: "b@b.com" }],
        subject: "high",
        priority: "high"
      },
      attempts: 0,
      enqueuedAt: new Date(),
      nextRetryAt: Date.now(),
      status: EmailStatus.QUEUED
    });
    expect((await q.dequeue())?.id).toBe("2");
  });
});
