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

/**
 * DeliveryEngine - Orchestrates email delivery with retry logic, fallback providers, and rate limiting.
 * 
 * This class handles the complete delivery process:
 * - Attempts to send using available providers in order
 * - Applies retry policy with exponential backoff
 * - Checks circuit breakers to skip failed providers
 * - Respects rate limits to avoid provider throttling
 * - Emits retry events for tracking
 * 
 * The engine uses a fallback chain to rotate through providers on failure.
 */
export class DeliveryEngine {
  /**
   * Constructs a DeliveryEngine with configured delivery strategies.
   * 
   * @param fallbackChain - Chain of providers to try in sequence
   * @param retryPolicy - Policy determining retry behavior and delays
   * @param circuitBreakers - Map of circuit breakers per provider for failure isolation
   * @param rateLimiters - Map of rate limiters per provider
   * @param eventEmitter - Event emitter for delivery tracking
   */
  constructor(
    private readonly fallbackChain: FallbackChain,
    private readonly retryPolicy: RetryPolicy,
    private readonly circuitBreakers: Map<string, CircuitBreaker>,
    private readonly rateLimiters: Map<string, RateLimiter>,
    private readonly eventEmitter: EmailEventEmitter
  ) {}

  /**
   * Attempts to deliver an email with retry and fallback logic.
   * 
   * This method:
   * - Gets available providers from the fallback chain
   * - For each provider, acquires a rate limit token
   * - Attempts to send via the provider
   * - Records success/failure with circuit breaker
   * - Retries with exponential backoff on failure if allowed
   * - Emits retrying events
   * - Throws error after exhausting retries
   * 
   * @param job - Queue job containing email payload and retry metadata
   * @returns Promise resolving to SendResult with delivery status and attempt count
   * @throws ProviderError if no providers available or all attempts exhausted
   */
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
