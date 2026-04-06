import { EmailEventEmitter } from "../events/EmailEventEmitter";
import { SDKStats } from "../types/SDKStats";

interface MetricPoint {
  ts: number;
  provider: string;
  latencyMs: number;
  success: boolean;
}

export class MetricsCollector {
  private totalQueued = 0;
  private readonly points: MetricPoint[] = [];

  constructor(private readonly retentionMs: number) {}

  public attach(emitter: EmailEventEmitter): void {
    emitter.on("email.queued", () => {
      this.totalQueued += 1;
    });
    emitter.on("email.sent", (e) => {
      this.points.push({
        ts: Date.now(),
        provider: e.provider ?? "unknown",
        latencyMs: 0,
        success: true
      });
      this.compact();
    });
    emitter.on("email.failed", (e) => {
      this.points.push({
        ts: Date.now(),
        provider: e.provider ?? "unknown",
        latencyMs: 0,
        success: false
      });
      this.compact();
    });
  }

  public getStats(): SDKStats {
    this.compact();
    const byProvider: SDKStats["byProvider"] = {};
    let totalSent = 0;
    let totalFailed = 0;
    for (const point of this.points) {
      const item = byProvider[point.provider] ?? { sent: 0, failed: 0, avgLatencyMs: 0 };
      if (point.success) {
        item.sent += 1;
        totalSent += 1;
      } else {
        item.failed += 1;
        totalFailed += 1;
      }
      byProvider[point.provider] = item;
    }

    return {
      totalQueued: this.totalQueued,
      totalSent,
      totalFailed,
      byProvider
    };
  }

  private compact(): void {
    const cutoff = Date.now() - this.retentionMs;
    let firstValid = 0;
    while (firstValid < this.points.length && this.points[firstValid].ts < cutoff) {
      firstValid += 1;
    }
    if (firstValid > 0) {
      this.points.splice(0, firstValid);
    }
  }
}
