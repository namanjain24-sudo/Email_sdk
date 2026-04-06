export interface ProviderStats {
  sent: number;
  failed: number;
  avgLatencyMs: number;
}

export interface SDKStats {
  totalQueued: number;
  totalSent: number;
  totalFailed: number;
  byProvider: Record<string, ProviderStats>;
}
