export interface ProviderHealth {
  provider: string;
  status: "UP" | "DOWN" | "DEGRADED";
  latencyMs?: number;
  checkedAt: Date;
}
