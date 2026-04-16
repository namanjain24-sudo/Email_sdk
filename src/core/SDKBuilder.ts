import { CircuitBreaker } from "../delivery/CircuitBreaker";
import { DeliveryEngine } from "../delivery/DeliveryEngine";
import { FallbackChain } from "../delivery/FallbackChain";
import { RateLimiter } from "../delivery/RateLimiter";
import { RetryPolicy } from "../delivery/RetryPolicy";
import { EmailSDK } from "./EmailSDK";
import { IEmailProvider } from "../providers/IEmailProvider";
import { ProviderRegistry } from "../providers/ProviderRegistry";
import { MockProvider, MockProviderOptions } from "../providers/MockProvider";
import { ProviderConfig, SDKConfig } from "../types/SDKConfig";
import { EmailQueue } from "../queue/EmailQueue";
import { DLQHandler } from "../queue/DLQHandler";
import { EmailProviderFactory } from "../providers/EmailProviderFactory";
import { EmailEventEmitter } from "../events/EmailEventEmitter";
import { ConsoleLogger } from "../events/ConsoleLogger";
import { FileLogger } from "../events/FileLogger";
import { MetricsCollector } from "../analytics/MetricsCollector";
import { HealthChecker } from "../analytics/HealthChecker";
import { TemplateFactory, TemplateEngineType } from "../templates/TemplateFactory";
import { TemplateCache } from "../templates/TemplateCache";

/**
 * SDKBuilder - Builder pattern implementation for configuring and creating EmailSDK instances.
 * 
 * This class provides a fluent API for:
 * - Adding email providers (SMTP, AWS SES, SendGrid, Mock)
 * - Configuring retry policies and fallback behavior
 * - Setting queue, circuit breaker, and rate limiting parameters
 * - Enabling logging and metrics collection
 * - Selecting template engines
 * 
 * Uses the Builder pattern to ensure the SDK is constructed with valid, complete configuration.
 */
export class SDKBuilder {
  private readonly registry = new ProviderRegistry();
  private readonly providers: IEmailProvider[] = [];
  private config: SDKConfig = {
    providers: [],
    queue: {
      maxSize: 10000,
      concurrency: 5,
      pollIntervalMs: 100
    },
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      jitter: true
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeMs: 60000
    },
    rateLimit: {
      tokensPerSecond: 100,
      burstCapacity: 200,
      mode: "wait"
    },
    logging: {
      level: "info",
      destinations: ["console"]
    },
    metrics: {
      retentionMs: 60 * 60 * 1000
    }
  };
  private templateEngineType: TemplateEngineType = "handlebars";

  /**
   * Adds a mock email provider for testing.
   * 
   * The mock provider simulates email sending with configurable failure rates and latencies.
   * Useful for integration testing without hitting real email services.
   * 
   * @param name - Provider name (e.g., "mock", "test-provider")
   * @param options - Configuration for mock behavior
   * @param options.failureRate - Probability (0-1) of simulating a send failure
   * @param options.baseLatencyMs - Simulated send latency in milliseconds
   * @returns This builder instance for method chaining
   */
  public addMockProvider(name: string, options: MockProviderOptions = {}): SDKBuilder {
    const provider = new MockProvider(name, options);
    this.registry.register(provider);
    this.providers.push(provider);
    return this;
  }

  /**
   * Adds a real email provider (SMTP, SES, or SendGrid).
   * 
   * This registers a production email provider and adds it to the fallback chain.
   * Multiple providers can be added for redundancy and load distribution.
   * 
   * @param type - Provider type: "smtp", "ses", "sendgrid", or "mock"
   * @param options - Provider-specific configuration (host/port for SMTP, API keys for SES/SendGrid)
   * @param name - Optional custom name for the provider (defaults to provider type)
   * @returns This builder instance for method chaining
   * 
   * @example
   * builder.addProvider('smtp', { host: 'localhost', port: 587, secure: false })
   *        .addProvider('sendgrid', { apiKey: 'sg_...' }, 'sendgrid-primary');
   */
  public addProvider(type: ProviderConfig["type"], options: Record<string, unknown>, name?: string): SDKBuilder {
    const config: ProviderConfig = { type, options, name };
    const provider = EmailProviderFactory.create(config);
    this.registry.register(provider);
    this.providers.push(provider);
    this.config.providers.push(config);
    return this;
  }

  /**
   * Configures retry policy parameters.
   * 
   * Determines how the SDK retries failed emails, including maximum attempts,
   * delay calculation, and whether to use jitter to prevent thundering herd.
   * 
   * @param overrides - Partial retry configuration to override defaults
   * @param overrides.maxAttempts - Maximum retry attempts (default: 3)
   * @param overrides.baseDelayMs - Base delay between retries in milliseconds (default: 1000)
   * @param overrides.maxDelayMs - Maximum delay between retries (default: 30000)
   * @param overrides.jitter - Whether to add random jitter to delays (default: true)
   * @returns This builder instance for method chaining
   */
  public withRetry(overrides: Partial<SDKConfig["retry"]>): SDKBuilder {
    this.config = {
      ...this.config,
      retry: { ...this.config.retry, ...overrides }
    };
    return this;
  }

  /**
   * Configures the email queue parameters.
   * 
   * Controls how emails are buffered and processed, including queue capacity,
   * concurrency level, and polling frequency for new messages.
   * 
   * @param overrides - Partial queue configuration to override defaults
   * @param overrides.maxSize - Maximum number of emails in queue (default: 10000)
   * @param overrides.concurrency - Number of concurrent workers (default: 5)
   * @param overrides.pollIntervalMs - Queue polling interval in milliseconds (default: 100)
   * @returns This builder instance for method chaining
   */
  public withQueue(overrides: Partial<SDKConfig["queue"]>): SDKBuilder {
    this.config = {
      ...this.config,
      queue: { ...this.config.queue, ...overrides }
    };
    return this;
  }

  /**
   * Configures circuit breaker parameters for provider failure isolation.
   * 
   * When a provider fails repeatedly, the circuit breaker prevents further requests
   * temporarily, then gradually allows traffic to resume (half-open state).
   * 
   * @param overrides - Partial circuit breaker configuration
   * @param overrides.failureThreshold - Number of failures before opening circuit (default: 5)
   * @param overrides.recoveryTimeMs - Time in milliseconds before entering half-open state (default: 60000)
   * @returns This builder instance for method chaining
   */
  public withCircuitBreaker(overrides: Partial<SDKConfig["circuitBreaker"]>): SDKBuilder {
    this.config = {
      ...this.config,
      circuitBreaker: { ...this.config.circuitBreaker, ...overrides }
    };
    return this;
  }
  /**
   * Configures rate limiting parameters to control email send rate.
   * 
   * Prevents overwhelming providers with too many concurrent requests using
   * a token bucket algorithm.
   * 
   * @param overrides - Partial rate limit configuration
   * @param overrides.tokensPerSecond - Send rate in emails per second (default: 100)
   * @param overrides.burstCapacity - Maximum burst size (default: 200)
   * @param overrides.mode - "wait" (queue requests) or "throw" (reject when limited)
   * @returns This builder instance for method chaining
   */  public withRateLimit(overrides: Partial<SDKConfig["rateLimit"]>): SDKBuilder {
    this.config = {
      ...this.config,
      rateLimit: { ...this.config.rateLimit, ...overrides }
    };
    return this;
  }

  /**
   * Configures logging for the SDK.
   * 
   * Enables console and/or file logging of email events (queued, sent, failed, retrying, bounced).
   * 
   * @param overrides - Partial logging configuration
   * @param overrides.level - Log level: "debug", "info", "warn", or "error"
   * @param overrides.destinations - Array of destinations: "console" and/or "file"
   * @param overrides.filePath - File path for file logging (required if "file" is in destinations)
   * @returns This builder instance for method chaining
   */
  public withLogging(overrides: Partial<SDKConfig["logging"]>): SDKBuilder {
    this.config = {
      ...this.config,
      logging: { ...this.config.logging, ...overrides }
    };
    return this;
  }

  /**
   * Sets the template engine for email template compilation and rendering.
   * 
   * @param type - Template engine type: "handlebars" or "mustache" (default: "handlebars")
   * @returns This builder instance for method chaining
   */
  public withTemplateEngine(type: TemplateEngineType): SDKBuilder {
    this.templateEngineType = type;
    return this;
  }

  /**
   * Builds and returns a fully configured EmailSDK instance.
   * 
   * This method validates the configuration, initializes all components
   * (providers, queues, workers, loggers, metrics), and returns a ready-to-use SDK.
   * 
   * @returns Initialized EmailSDK instance
   * @throws Error if no providers are configured
   * 
   * @example
   * const sdk = new SDKBuilder()
   *   .addProvider('sendgrid', { apiKey: '...' })
   *   .addProvider('smtp', { host: 'localhost', port: 587 })
   *   .withRetry({ maxAttempts: 5 })
   *   .withLogging({ destinations: ['console', 'file'], filePath: './logs/email.log' })
   *   .build();
   */
  public build(): EmailSDK {
    if (this.providers.length === 0) {
      throw new Error("At least one provider must be configured");
    }

    const queue = new EmailQueue(this.config.queue.maxSize);
    const dlq = new DLQHandler();
    const retryPolicy = new RetryPolicy(this.config.retry);
    const breakers = new Map<string, CircuitBreaker>();
    const rateLimiters = new Map<string, RateLimiter>();
    for (const provider of this.providers) {
      breakers.set(provider.name, new CircuitBreaker(this.config.circuitBreaker));
      rateLimiters.set(provider.name, new RateLimiter(this.config.rateLimit));
    }
    const fallbackChain = new FallbackChain(this.providers, breakers);
    const emitter = new EmailEventEmitter();
    const metrics = new MetricsCollector(this.config.metrics.retentionMs);
    metrics.attach(emitter);
    if (this.config.logging.destinations.includes("console")) {
      new ConsoleLogger().attach(emitter);
    }
    if (this.config.logging.destinations.includes("file") && this.config.logging.filePath) {
      new FileLogger(this.config.logging.filePath).attach(emitter);
    }
    const templateEngine = TemplateFactory.create({ type: this.templateEngineType });
    const templateCache = new TemplateCache(100);
    const healthChecker = new HealthChecker(this.providers);
    const engine = new DeliveryEngine(fallbackChain, retryPolicy, breakers, rateLimiters, emitter);

    return new EmailSDK(
      queue,
      dlq,
      engine,
      emitter,
      metrics,
      healthChecker,
      templateEngine,
      templateCache,
      this.config.queue.concurrency,
      this.config.queue.pollIntervalMs
    );
  }
}
