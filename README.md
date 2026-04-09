TypeScript Email SDK implementing the mandatory high-level system design concepts from your PRD.

## Run

- `npm install`
- `npm run typecheck`
- `npm run test`
- `npm run example:basic`
- `npm run example:fallback`
- `npm run example:bulk`

## System Design Coverage (2.1 - 2.10)

- `2.1 Provider Abstraction`: `IEmailProvider`, `BaseProvider`, `SmtpProvider`, `AwsSesProvider`, `SendGridProvider`, `ProviderRegistry`
- `2.2 Factory`: `EmailProviderFactory`, `TemplateFactory`
- `2.3 Async Queue + Back-pressure`: `EmailQueue`, `QueueWorker`, `DLQHandler`, queue full rejection
- `2.4 Retry + Backoff`: `RetryPolicy` with jitter and retryable/non-retryable code handling
- `2.5 Fallback + Circuit Breaker`: `FallbackChain`, per-provider `CircuitBreaker` state machine
- `2.6 Rate Limiting`: per-provider token bucket in `RateLimiter` with wait/throw behavior
- `2.7 Template Engine`: `ITemplateEngine`, `HandlebarsEngine`, `MustacheEngine`, LRU `TemplateCache`
- `2.8 Observer`: `EmailEventEmitter`, `ConsoleLogger`, `FileLogger` with JSON logs
- `2.9 DI/IoC`: constructor injection in `EmailSDK`, fluent wiring in `SDKBuilder`
- `2.10 Analytics`: `MetricsCollector`, `HealthChecker`, `sdk.getStats()`, `sdk.healthCheck()`

System Architecture Diagram

<img width="488" height="867" alt="Screenshot 2026-04-09 at 10 11 21 AM" src="https://github.com/user-attachments/assets/b2e4a05b-ab2c-4b1a-883c-cf585ea7ab2b" />

