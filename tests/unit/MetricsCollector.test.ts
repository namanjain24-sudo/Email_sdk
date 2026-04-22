import { describe, expect, it } from "vitest";
import { EmailEventEmitter } from "../../src/events/EmailEventEmitter";
import { MetricsCollector } from "../../src/analytics/MetricsCollector";

describe("MetricsCollector", () => {
  it("tracks sent/failed counts and avg latency by provider", () => {
    const emitter = new EmailEventEmitter();
    const metrics = new MetricsCollector(60_000);
    metrics.attach(emitter);

    emitter.emit("email.queued", { messageId: "1", correlationId: "c1", status: "queued", timestamp: new Date().toISOString() });
    emitter.emit("email.sent", { messageId: "1", correlationId: "c1", provider: "p1", status: "sent", latencyMs: 10, timestamp: new Date().toISOString() });
    emitter.emit("email.sent", { messageId: "2", correlationId: "c2", provider: "p1", status: "sent", latencyMs: 30, timestamp: new Date().toISOString() });
    emitter.emit("email.failed", { messageId: "3", correlationId: "c3", provider: "p1", status: "failed", latencyMs: 20, timestamp: new Date().toISOString() });

    const stats = metrics.getStats();
    expect(stats.totalQueued).toBe(1);
    expect(stats.totalSent).toBe(2);
    expect(stats.totalFailed).toBe(1);
    expect(stats.byProvider.p1.sent).toBe(2);
    expect(stats.byProvider.p1.failed).toBe(1);
    expect(stats.byProvider.p1.avgLatencyMs).toBe(20);
  });
});

