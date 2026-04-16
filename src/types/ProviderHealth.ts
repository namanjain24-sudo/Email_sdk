/**
 * ProviderHealth - Health status of an email provider.
 * 
 * Returned from health checks to indicate provider availability
 * and performance characteristics.
 */
export interface ProviderHealth {
  /** Provider name being checked */
  provider: string;
  /** Health status: UP (healthy), DOWN (unavailable), or DEGRADED (slow/partial) */
  status: "UP" | "DOWN" | "DEGRADED";
  /** Optional response latency in milliseconds */
  latencyMs?: number;
  /** Timestamp when health check was performed */
  checkedAt: Date;
}
