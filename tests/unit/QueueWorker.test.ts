import { describe, expect, it } from "vitest";
import { EmailQueue } from "../../src/queue/EmailQueue";
import { DLQHandler } from "../../src/queue/DLQHandler";
import { QueueWorker } from "../../src/queue/QueueWorker";
import { EmailEventEmitter } from "../../src/events/EmailEventEmitter";
import { EmailStatus } from "../../src/types/EmailStatus";
import type { QueueJob } from "../../src/queue/EmailQueue";
import type { DeliveryDecision } from "../../src/delivery/DeliveryEngine";
import type { SendResult } from "../../src/types/SendResult";

describe("QueueWorker", () => {
  it("re-enqueues on retry then resolves on success", async () => {
    const queue = new EmailQueue(10);
    const dlq = new DLQHandler();
    const emitter = new EmailEventEmitter();

    let calls = 0;
    const deliveryEngine = {
      async deliver(job: QueueJob): Promise<DeliveryDecision> {
        calls += 1;
        if (calls === 1) {
          return { kind: "retry", delayMs: 1, error: new Error("retry"), providerName: "p1" };
        }
        const result: SendResult = {
          messageId: job.id,
          provider: "p1",
          status: EmailStatus.SENT,
          attempts: job.attempts + 1,
          latencyMs: 1,
          timestamp: new Date()
        };
        return { kind: "sent", result };
      }
    } as never;

    const worker = new QueueWorker(queue, deliveryEngine, dlq, emitter, 1, 5);

    const res = await new Promise<SendResult>((resolve, reject) => {
      worker.start(() => {}, () => {});
      void queue.enqueue({
        id: "m1",
        correlationId: "c1",
        payload: { from: { email: "a@a.com" }, to: [{ email: "b@b.com" }], subject: "s" },
        attempts: 0,
        enqueuedAt: new Date(),
        nextRetryAt: Date.now(),
        status: EmailStatus.QUEUED,
        resolve,
        reject
      });
    });

    expect(res.provider).toBe("p1");
    expect(dlq.list().length).toBe(0);
    await worker.stop();
  });

  it("moves to DLQ on terminal failure and emits failed event", async () => {
    const queue = new EmailQueue(10);
    const dlq = new DLQHandler();
    const emitter = new EmailEventEmitter();

    const deliveryEngine = {
      async deliver(): Promise<DeliveryDecision> {
        return { kind: "failed", error: new Error("boom"), providerName: "p1" };
      }
    } as never;

    const worker = new QueueWorker(queue, deliveryEngine, dlq, emitter, 1, 5);

    const failed = new Promise<{ messageId: string }>((resolve) => {
      emitter.on("email.failed", (e) => resolve(e));
    });

    worker.start(() => {}, () => {});
    await queue.enqueue({
      id: "m2",
      correlationId: "c2",
      payload: { from: { email: "a@a.com" }, to: [{ email: "b@b.com" }], subject: "s" },
      attempts: 0,
      enqueuedAt: new Date(),
      nextRetryAt: Date.now(),
      status: EmailStatus.QUEUED
    });

    const evt = await failed;
    expect(evt.messageId).toBe("m2");
    expect(dlq.list().length).toBe(1);
    await worker.stop();
  });
});

