import { EmailPayload } from "../types/EmailPayload";
import { SendResult } from "../types/SendResult";
import { RetryPolicy } from "./RetryPolicy";
import { FallbackChain } from "./FallbackChain";
import { CircuitBreaker } from "./CircuitBreaker";
import { QueueJob } from "../queue/EmailQueue";
import { RateLimiter } from "./RateLimiter";
import { ProviderError } from "../errors/ProviderError";
import { EmailStatus } from "../types/EmailStatus";
import { EmailEventEmitter } from "../events/EmailEventEmitter";

export class DeliveryEngine {
  constructor(
    private readonly fallbackChain: FallbackChain,
    private readonly retryPolicy: RetryPolicy,
    private readonly circuitBreakers: Map<string, CircuitBreaker>,
    private readonly rateLimiters: Map<string, RateLimiter>,
    private readonly eventEmitter: EmailEventEmitter
  ) {}

  public async deliver(job: QueueJob): Promise<SendResult> {
    const payload: EmailPayload = job.payload;
    let attempt = job.attempts;
    let lastError: unknown;

    while (attempt < 100) {
      const providers = this.fallbackChain.orderedAvailable();
      if (providers.length === 0) {
        throw new ProviderError(
          "No available provider in fallback chain",
          job.correlationId,
          "none",
          true
        );
      }

      for (const provider of providers) {
        const breaker = this.circuitBreakers.get(provider.name);
        try {
          await this.rateLimiters.get(provider.name)?.acquire(job.correlationId);
          const result = await provider.send(payload);
          breaker?.recordSuccess();
          return { ...result, attempts: attempt + 1, status: EmailStatus.SENT };
        } catch (error) {
          lastError = error;
          breaker?.recordFailure();
          const shouldRetry = this.retryPolicy.shouldRetry(error, attempt + 1);
          if (!shouldRetry) {
            continue;
          }
          const delay = this.retryPolicy.getDelay(attempt);
          this.eventEmitter.emitRetrying({
            messageId: job.id,
            correlationId: job.correlationId,
            provider: provider.name,
            status: EmailStatus.RETRYING,
            attempt: attempt + 1,
            delayMs: delay,
            reason: error instanceof Error ? error.message : "Unknown retry error",
            timestamp: new Date().toISOString()
          });
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
          attempt += 1;
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Delivery failed after retries");
  }
}
