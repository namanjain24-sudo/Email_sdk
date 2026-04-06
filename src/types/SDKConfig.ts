export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

export interface RateLimitConfig {
  tokensPerSecond: number;
  burstCapacity: number;
  mode: "wait" | "throw";
}

export interface QueueConfig {
  maxSize: number;
  concurrency: number;
  pollIntervalMs: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeMs: number;
}

export interface SDKConfig {
  providers: ProviderConfig[];
  queue: QueueConfig;
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  rateLimit: RateLimitConfig;
  logging: {
    level: "debug" | "info" | "warn" | "error";
    destinations: Array<"console" | "file">;
    filePath?: string;
  };
  metrics: {
    retentionMs: number;
  };
}

export interface ProviderConfig {
  type: "smtp" | "ses" | "sendgrid" | "mock";
  name?: string;
  options: Record<string, unknown>;
}
