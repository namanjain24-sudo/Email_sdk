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

  public addMockProvider(name: string, options: MockProviderOptions = {}): SDKBuilder {
    const provider = new MockProvider(name, options);
    this.registry.register(provider);
    this.providers.push(provider);
    return this;
  }

  public addProvider(type: ProviderConfig["type"], options: Record<string, unknown>, name?: string): SDKBuilder {
    const config: ProviderConfig = { type, options, name };
    const provider = EmailProviderFactory.create(config);
    this.registry.register(provider);
    this.providers.push(provider);
    this.config.providers.push(config);
    return this;
  }

  public withRetry(overrides: Partial<SDKConfig["retry"]>): SDKBuilder {
    this.config = {
      ...this.config,
      retry: { ...this.config.retry, ...overrides }
    };
    return this;
  }

  public withQueue(overrides: Partial<SDKConfig["queue"]>): SDKBuilder {
    this.config = {
      ...this.config,
      queue: { ...this.config.queue, ...overrides }
    };
    return this;
  }

  public withCircuitBreaker(overrides: Partial<SDKConfig["circuitBreaker"]>): SDKBuilder {
    this.config = {
      ...this.config,
      circuitBreaker: { ...this.config.circuitBreaker, ...overrides }
    };
    return this;
  }

  public withRateLimit(overrides: Partial<SDKConfig["rateLimit"]>): SDKBuilder {
    this.config = {
      ...this.config,
      rateLimit: { ...this.config.rateLimit, ...overrides }
    };
    return this;
  }

  public withLogging(overrides: Partial<SDKConfig["logging"]>): SDKBuilder {
    this.config = {
      ...this.config,
      logging: { ...this.config.logging, ...overrides }
    };
    return this;
  }

  public withTemplateEngine(type: TemplateEngineType): SDKBuilder {
    this.templateEngineType = type;
    return this;
  }

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
