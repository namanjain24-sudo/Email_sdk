/**
 * RetryConfig - Configuration for email retry behavior.
 * 
 * Determines how failed emails should be retried with exponential backoff.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Base delay in milliseconds for first retry (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay cap between retries (default: 30000) */
  maxDelayMs: number;
  /** Whether to add random jitter to retry delays (default: true) */
  jitter: boolean;
}

/**
 * RateLimitConfig - Configuration for send rate limiting.
 * 
 * Uses token bucket algorithm to prevent overwhelming providers.
 */
export interface RateLimitConfig {
  /** Tokens issued per second (send rate) (default: 100) */
  tokensPerSecond: number;
  /** Maximum burst capacity (default: 200) */
  burstCapacity: number;
  /** Action on rate limit: "wait" (queue) or "throw" (reject) (default: "wait") */
  mode: "wait" | "throw";
}

/**
 * QueueConfig - Configuration for the email queue.
 * 
 * Controls how emails are buffered and processed.
 */
export interface QueueConfig {
  /** Maximum messages in queue (default: 10000) */
  maxSize: number;
  /** Number of concurrent queue workers (default: 5) */
  concurrency: number;
  /** Polling interval in milliseconds (default: 100) */
  pollIntervalMs: number;
}

/**
 * CircuitBreakerConfig - Configuration for circuit breaker failsafe.
 * 
 * Prevents cascading failures by temporarily stopping requests to failing providers.
 */
export interface CircuitBreakerConfig {
  /** Failure count before opening circuit (default: 5) */
  failureThreshold: number;
  /** Time in milliseconds before transitioning to HALF_OPEN (default: 60000) */
  recoveryTimeMs: number;
}

/**
 * SDKConfig - Complete Email SDK configuration.
 * 
 * Aggregates all subsystem configurations into one object for builder initialization.
 */
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

/**
 * ProviderConfig - Configuration for a single email provider instance.
 * 
 * Specifies provider type, API credentials, and other options.
 */
export interface ProviderConfig {
  /** Provider type: "smtp", "ses", "sendgrid", or "mock" */
  type: "smtp" | "ses" | "sendgrid" | "mock";
  /** Optional custom name for this provider instance */
  name?: string;
  /** Provider-specific options (API keys, credentials, etc.) */
  options: Record<string, unknown>;
}
