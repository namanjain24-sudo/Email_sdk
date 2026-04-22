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

export type DeliveryDecision =
  | { kind: "sent"; result: SendResult }
  | { kind: "retry"; delayMs: number; error: unknown; providerName: string }
  | { kind: "failed"; error: unknown; providerName?: string };

export class DeliveryEngine {
  constructor(
    private readonly fallbackChain: FallbackChain,
    private readonly retryPolicy: RetryPolicy,
    private readonly circuitBreakers: Map<string, CircuitBreaker>,
    private readonly rateLimiters: Map<string, RateLimiter>,
    private readonly eventEmitter: EmailEventEmitter
  ) {}

  public async deliver(job: QueueJob): Promise<DeliveryDecision> {
    const payload: EmailPayload = job.payload;
    const providers = this.fallbackChain.orderedAvailable();
    if (providers.length === 0) {
      const error = new ProviderError("No available provider in fallback chain", job.correlationId, "none", true);
      const shouldRetry = this.retryPolicy.shouldRetry(error, job.attempts + 1);
      if (!shouldRetry) {
        return { kind: "failed", error, providerName: "none" };
      }
      return { kind: "retry", delayMs: this.retryPolicy.getDelay(job.attempts), error, providerName: "none" };
    }

    let lastError: unknown;
    let lastProvider: string | undefined;
    let sawRetryableFailure = false;

    for (const provider of providers) {
      lastProvider = provider.name;
      const breaker = this.circuitBreakers.get(provider.name);
      try {
        if (breaker && !breaker.canRequest()) {
          continue;
        }
        await this.rateLimiters.get(provider.name)?.acquire(job.correlationId);
        const result = await provider.send(payload);
        breaker?.recordSuccess();
        return {
          kind: "sent",
          result: { ...result, attempts: job.attempts + 1, status: EmailStatus.SENT }
        };
      } catch (error) {
        lastError = error;
        breaker?.recordFailure();

        // On failure, immediately try next provider (fallback-on-failure).
        // After exhausting providers, decide whether to re-enqueue based on RetryPolicy/maxAttempts.
        const shouldRetry = this.retryPolicy.shouldRetry(error, job.attempts + 1);
        if (shouldRetry) {
          sawRetryableFailure = true;
        }
        continue;
      }
    }

    if (sawRetryableFailure) {
      const delayMs = this.retryPolicy.getDelay(job.attempts);
      this.eventEmitter.emitRetrying({
        messageId: job.id,
        correlationId: job.correlationId,
        provider: lastProvider ?? "unknown",
        status: EmailStatus.RETRYING,
        attempt: job.attempts + 1,
        delayMs,
        reason: lastError instanceof Error ? lastError.message : "Unknown retry error",
        timestamp: new Date().toISOString()
      });
      const error =
        lastError ??
        new ProviderError("Retryable delivery failure", job.correlationId, lastProvider ?? "unknown", true);
      return { kind: "retry", delayMs, error, providerName: lastProvider ?? "unknown" };
    }

    return { kind: "failed", error: lastError ?? new ProviderError("Delivery failed", job.correlationId, lastProvider ?? "unknown", false), providerName: lastProvider };
  }
}
