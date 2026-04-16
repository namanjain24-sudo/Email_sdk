/**
 * ProviderStats - Performance statistics for a single provider.
 * 
 * Aggregated metrics from collected data points within retention window.
 */
export interface ProviderStats {
  /** Total emails successfully sent through this provider */
  sent: number;
  /** Total emails that failed through this provider */
  failed: number;
  /** Average send latency in milliseconds */
  avgLatencyMs: number;
}

/**
 * SDKStats - Aggregated email delivery statistics for the entire SDK.
 * 
 * Provides overview of SDK performance and provider breakdown.
 * Data is aggregated from metrics collected within the retention window.
 */
export interface SDKStats {
  /** Total emails queued since SDK started (or within retention) */
  totalQueued: number;
  /** Total emails successfully sent */
  totalSent: number;
  /** Total emails that failed permanently */
  totalFailed: number;
  /** Per-provider statistics keyed by provider name */
  byProvider: Record<string, ProviderStats>;
}
