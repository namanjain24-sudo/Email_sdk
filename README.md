TypeScript Email SDK implementing the mandatory high-level system design concepts from your PRD.

## Run

- `npm install`
- `npm run typecheck`
- `npm run test`
- `npm run example:basic`
- `npm run example:fallback`
- `npm run example:bulk`

## Environment

See `.env.example` for provider credentials and SDK settings.

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

### High-Level Text Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YOUR APPLICATION                             │
│    const sdk = new SDKBuilder().addProvider(...).build()            │
│    await sdk.send({ to, subject, html })                            │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ sdk.send()
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EmailSDK (Core Orchestrator)                      │
│  • Normalizes payload      • Generates messageId + correlationId    │
│  • Renders template (if templateId given)                           │
│  • Enqueues job            • Emits email.queued event               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ enqueue()
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│          EmailQueue (Priority Queue — max 10,000 jobs)              │
│  Sort: nextRetryAt → priority(high/normal/low) → enqueuedAt (FIFO) │
│  Back-pressure: throws QueueFullError if full                        │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ dequeue() [polled every 100ms]
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│              QueueWorker (5 concurrent async loops)                  │
│  • Continuously polls queue                                         │
│  • On success: calls onProcessed → emits email.sent                 │
│  • On failure: sends to DLQHandler → emits email.failed             │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ deliver(job)
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DeliveryEngine (Brain)                            │
│  1. Gets orderedAvailable providers from FallbackChain              │
│  2. For each provider:                                              │
│     a. RateLimiter.acquire() ← Token Bucket check                  │
│     b. provider.send(payload)                                       │
│     c. On success: breaker.recordSuccess(), return result           │
│     d. On failure: breaker.recordFailure()                          │
│        RetryPolicy.shouldRetry() → wait delay → retry              │
└──────┬──────────────────┬──────────────────┬────────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌────────────┐   ┌──────────────┐   ┌──────────────────┐
│ SES Provider│   │ SMTP Provider│   │ SendGrid Provider │
│ (primary)  │   │ (fallback 1) │   │  (fallback 2)    │
│ nodemailer │   │ nodemailer   │   │ @sendgrid/mail   │
│ SESClient  │   │ Transporter  │   │ sendgrid.send()  │
└─────┬──────┘   └──────┬───────┘   └────────┬─────────┘
      │                 │                    │
      ▼                 ▼                    ▼
   AWS SES          Mail Server          SendGrid API
  (us-east-1)     (smtp.example.com)   (api.sendgrid.com)
      │                 │                    │
      └─────────────────┴────────────────────┘
                        │
                        ▼
               Recipient's Inbox
               (user@gmail.com)

════════════════════════════════════════════════════════
RESILIENCE LAYER (per-provider)
════════════════════════════════════════════════════════

┌─────────────────────┐    ┌──────────────────────┐
│   CircuitBreaker    │    │     RateLimiter       │
│ CLOSED→OPEN (5fail) │    │  Token Bucket         │
│ OPEN→HALF after 60s │    │  100 tokens/sec       │
│ HALF→CLOSED (1 ok)  │    │  Burst: 200 tokens    │
└─────────────────────┘    └──────────────────────┘

┌─────────────────────┐    ┌──────────────────────┐
│    RetryPolicy      │    │   FallbackChain       │
│ Exp Backoff+Jitter  │    │  [SES, SMTP, SG]      │
│ maxAttempts: 3      │    │  Skip OPEN circuits   │
│ Non-retry: 400,401  │    │  Returns next live    │
└─────────────────────┘    └──────────────────────┘

════════════════════════════════════════════════════════
OBSERVABILITY LAYER
════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────┐
│              EmailEventEmitter                       │
│   Emits: queued | sent | failed | retrying | bounced│
└──────┬──────────────┬──────────────────┬────────────┘
       │              │                  │
       ▼              ▼                  ▼
┌────────────┐ ┌─────────────┐ ┌─────────────────────┐
│ConsoleLogger│ │ FileLogger  │ │  MetricsCollector   │
│ JSON→stdout │ │JSON→file.log│ │totalSent, failed,   │
└────────────┘ └─────────────┘ │byProvider, queued   │
                               └─────────────────────┘

════════════════════════════════════════════════════════
DLQ (Dead Letter Queue) — permanent failures land here
════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────┐
│                   DLQHandler                        │
│     failedJobs: QueueJob[]   (in-memory array)      │
│     .list() → inspect failed jobs manually          │
└─────────────────────────────────────────────────────┘

════════════════════════════════════════════════════════
TEMPLATES
════════════════════════════════════════════════════════

┌───────────────────┐      ┌──────────────────────────┐
│  TemplateFactory  │ ───▶ │  HandlebarsEngine /       │
│  (creates engine) │      │  MustacheEngine           │
└───────────────────┘      │  compile() + render()     │
                           └──────────────────────────┘
                                       │
                           ┌──────────────────────────┐
                           │   TemplateCache (LRU)    │
                           │   max 100 compiled tmpl  │
                           └──────────────────────────┘
```

System Architecture Diagram :
<img width="5246" height="8192" alt="Email SDK Delivery Pipeline-2026-04-28-193910" src="https://github.com/user-attachments/assets/822f2803-e1b5-454c-b475-f297bdbd3835" />" 

use case diag
<img width="537" height="601" alt="Screenshot 2026-04-29 at 9 01 44 AM" src="https://github.com/user-attachments/assets/632f7b05-ef9c-43d1-b9cc-bb54bc8b2a8b" />

UML Sequence Diagram
<img width="1280" height="891" alt="image" src="https://github.com/user-attachments/assets/16a1065f-e9ed-4990-a545-84e2caadebfc" />



UML Activity Diagram — Email Send Flow
<img width="3153" height="8192" alt="Email Sending Workflow with-2026-04-25-231014" src="https://github.com/user-attachments/assets/072c6648-06ea-47a9-b6e9-0120cf57c7a8" />


UML Class Diagram — System Structure
<img width="8192" height="6545" alt="Email Sending Workflow with-2026-04-25-231125" src="https://github.com/user-attachments/assets/3a25bd2d-acd7-4b25-b391-2d7ba3b66257" />
