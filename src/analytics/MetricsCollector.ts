import { EmailEventEmitter } from "../events/EmailEventEmitter";
import { SDKStats } from "../types/SDKStats";

/**
 * MetricPoint - Individual metric data point for an email event.
 * 
 * Stores:
 * - Timestamp of the event
 * - Provider that sent the email
 * - Send latency in milliseconds
 * - Success/failure status
 */
interface MetricPoint {
  ts: number;
  provider: string;
  latencyMs: number;
  success: boolean;
}

/**
 * MetricsCollector - Collects and aggregates email delivery metrics.
 * 
 * Tracks:
 * - Total emails queued
 * - Emails sent successfully per provider
 * - Emails failed per provider  
 * - Send latencies for performance monitoring
 * 
 * Automatically purges old metrics to stay within retention window.
 */
export class MetricsCollector {
  private totalQueued = 0;
  private readonly points: MetricPoint[] = [];

  /**
   * Constructs a MetricsCollector with retention window.
   * 
   * @param retentionMs - Time in milliseconds to retain metrics (e.g., 1 hour)
   */
  constructor(private readonly retentionMs: number) {}

  /**
   * Attaches this collector to an EmailEventEmitter.
   * 
   * Listens to queued, sent, and failed events to update metrics.
   * Automatically compacts old data after each update.
   * 
   * @param emitter - Event emitter to listen to
   */
  public attach(emitter: EmailEventEmitter): void {
    emitter.on("email.queued", () => {
      this.totalQueued += 1;
    });
    emitter.on("email.sent", (e) => {
      this.points.push({
        ts: Date.now(),
        provider: e.provider ?? "unknown",
        latencyMs: e.latencyMs ?? 0,
        success: true
      });
      this.compact();
    });
    emitter.on("email.failed", (e) => {
      this.points.push({
        ts: Date.now(),
        provider: e.provider ?? "unknown",
        latencyMs: e.latencyMs ?? 0,
        success: false
      });
      this.compact();
    });
  }

  /**
   * Retrieves current metrics as SDKStats.
   * 
   * Aggregates all collected metric points into:
   * - Total emails queued
   * - Total sent/failed (all time in retention window)
   * - Per-provider sent/failed counts
   * 
   * @returns Current SDK statistics
   */
  public getStats(): SDKStats {
    this.compact();
    const byProvider: SDKStats["byProvider"] = {};
    let totalSent = 0;
    let totalFailed = 0;
    const latencyAgg: Record<string, { sum: number; count: number }> = {};
    for (const point of this.points) {
      const item = byProvider[point.provider] ?? { sent: 0, failed: 0, avgLatencyMs: 0 };
      if (point.success) {
        item.sent += 1;
        totalSent += 1;
      } else {
        item.failed += 1;
        totalFailed += 1;
      }
      const agg = latencyAgg[point.provider] ?? { sum: 0, count: 0 };
      agg.sum += point.latencyMs;
      agg.count += 1;
      latencyAgg[point.provider] = agg;
      byProvider[point.provider] = item;
    }

    for (const [provider, agg] of Object.entries(latencyAgg)) {
      const item = byProvider[provider];
      if (item) {
        item.avgLatencyMs = agg.count > 0 ? Math.round(agg.sum / agg.count) : 0;
      }
    }

    return {
      totalQueued: this.totalQueued,
      totalSent,
      totalFailed,
      byProvider
    };
  }

  /**
   * Removes metric data older than retention window.
   * 
   * Purges old metric points to prevent unbounded memory growth.
   * Called automatically after events to maintain size.
   */
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
