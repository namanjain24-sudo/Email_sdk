import { describe, expect, it } from "vitest";
import { EmailQueue } from "../../src/queue/EmailQueue";

describe("EmailQueue", () => {
  it("dequeues by priority", () => {
    const q = new EmailQueue(10);
    q.enqueue({
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
      nextRetryAt: Date.now()
    });
    q.enqueue({
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
      nextRetryAt: Date.now()
    });
    expect(q.dequeue()?.id).toBe("2");
  });
});
