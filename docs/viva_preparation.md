# 📧 Email SDK — Complete Viva Preparation Guide
### (Senior System Design Interviewer + Backend Architect + Professor Perspective)

> **How to use this document:** Read each section carefully. The 🔑 icon marks points you *must* memorize. The 💡 icon marks analogies. The ⚠️ icon marks tricky questions professors love to ask.

---

## TABLE OF CONTENTS

1. [Part 1 — Project Understanding](#part-1-project-understanding)
2. [Part 2 — End-to-End Flow](#part-2-end-to-end-flow)
3. [Part 3 — System Design Deep Dive](#part-3-system-design-deep-dive)
4. [Part 4 — Architecture Diagram](#part-4-architecture-diagram)
5. [Part 5 — Database Design](#part-5-database-design)
6. [Part 6 — Optimization & Trade-offs](#part-6-optimization--trade-offs)
7. [Part 7 — "What If We Remove This?" Questions](#part-7-what-if-we-remove-this-questions)
8. [Part 8 — Interview Q&A (20+ Questions)](#part-8-interview-qa-20-questions)
9. [Part 9 — Edge Cases & Failure Scenarios](#part-9-edge-cases--failure-scenarios)
10. [Part 10 — Advanced Improvements](#part-10-advanced-improvements)
11. [Quick Revision Cheat Sheet](#quick-revision-cheat-sheet)

---

---

## PART 1 — PROJECT UNDERSTANDING

### What Problem Does This Project Solve?

Imagine you are building an e-commerce app. You need to send emails for:
- Order confirmation
- OTP for login
- Password reset
- Weekly newsletter

You might think: "I'll just use SendGrid." But what happens when:
- SendGrid goes down at 2 AM?
- You exceed your SendGrid quota and get a 429 rate-limit error?
- You want to switch to AWS SES to save cost?
- Your app sends 10,000 emails at once — will the provider handle it?

**Your Email SDK solves ALL of these problems.**

It is a **provider-agnostic, resilient TypeScript library** that sits between your application and any email delivery service. It handles:

| Problem | Solution in this SDK |
|---|---|
| Provider goes down | FallbackChain + CircuitBreaker |
| Too many emails at once | EmailQueue + Back-pressure |
| Provider rate limits | RateLimiter (Token Bucket) |
| Flaky network errors | RetryPolicy with Exponential Backoff |
| Vendor lock-in | IEmailProvider abstraction (Strategy Pattern) |
| No visibility into failures | EventEmitter + MetricsCollector + Loggers |
| Hard-coded email HTML | Template Engine (Handlebars / Mustache) |
| Hard to configure | Builder Pattern (SDKBuilder) |

---

### Who Are The Users?

| User Type | How They Use the SDK |
|---|---|
| **Backend Developers** | Install the npm package, call `sdk.send()` from their Node.js app |
| **SaaS Companies** | Use it to send transactional emails to their customers |
| **Startups** | Configure multiple providers cheaply — SES primary, SMTP fallback |
| **Enterprise** | Plug into existing infrastructure; swap providers without code changes |
| **DevOps/SRE** | Use `healthCheck()` and `getStats()` to monitor delivery health |

---

### Real-World Use Cases

```
1. OTP / Two-Factor Auth     → need instant delivery (high priority)
2. Welcome Email             → triggered on user signup
3. Order Confirmation        → transactional, must-deliver
4. Password Reset            → time-sensitive, must not duplicate
5. Invoice / Receipt         → needs HTML template with dynamic data
6. Newsletter                → bulk email (low priority, can be slow)
7. Alert Notifications       → system alerts to admin teams
8. Webhook Failure Alerts    → developer notifications
```

🔑 **Key phrase to memorize:** *"This SDK decouples the application from the delivery mechanism, providing resilience, observability, and extensibility."*

---

---

## PART 2 — END-TO-END FLOW

### Complete Lifecycle (Step by Step)

```
STEP 1: Developer configuration (one-time setup)
STEP 2: Application calls sdk.send()
STEP 3: Payload normalization & template rendering
STEP 4: Enqueuing with priority
STEP 5: QueueWorker dequeues (concurrently)
STEP 6: RateLimiter checks tokens
STEP 7: FallbackChain picks available provider
STEP 8: CircuitBreaker allows/blocks the call
STEP 9: Provider sends the email
STEP 10: Success/failure → events emitted → metrics updated
STEP 11: On failure → RetryPolicy decides if retryable
STEP 12: Non-retryable → Dead Letter Queue (DLQ)
```

---

### Detailed Flow Walkthrough

#### STEP 1: Developer Configures the SDK

```typescript
const sdk = new SDKBuilder()
  .addProvider("ses", { region: "us-east-1" })          // Primary
  .addProvider("smtp", { host: "smtp.example.com" }, "fallback-smtp")  // Fallback
  .withRetry({ maxAttempts: 3, baseDelayMs: 1000, jitter: true })
  .withCircuitBreaker({ failureThreshold: 5, recoveryTimeMs: 60000 })
  .withRateLimit({ tokensPerSecond: 100, burstCapacity: 200, mode: "wait" })
  .withLogging({ destinations: ["console", "file"], filePath: "logs/email.log" })
  .build();
```

> 💡 **Analogy:** `SDKBuilder` is like a car assembly line. You add parts one-by-one (providers, retry, logging), and at the end `.build()` hands you a fully-assembled, ready-to-drive car.

**Internally, `build()` does:**
1. Creates `EmailQueue` (max 10,000 slots)
2. Creates `DLQHandler`
3. Creates `RetryPolicy` from config
4. Creates one `CircuitBreaker` per provider
5. Creates one `RateLimiter` per provider
6. Creates `FallbackChain` from the provider list + circuit breakers
7. Creates `EmailEventEmitter`
8. Attaches `MetricsCollector` and loggers to the emitter
9. Creates `TemplateCache` (LRU, max 100 templates)
10. Creates `HealthChecker`
11. Creates `DeliveryEngine`
12. Creates `EmailSDK` with concurrency=5 worker loops, pollInterval=100ms

---

#### STEP 2: Application Calls `sdk.send()`

```typescript
const result = await sdk.send({
  from: { email: "no-reply@myapp.com" },
  to: [{ email: "customer@gmail.com" }],
  subject: "Your OTP is 4821",
  html: "<b>Your OTP: 4821</b>",
  priority: "high"
}, { awaitResult: true });
```

**Inside `send()`:**
- Generates a unique `messageId` = `msg_<timestamp>_<random6chars>`
- Generates a `correlationId` = `corr_<timestamp>_<random6chars>` (for tracing)
- Normalizes the payload (spreads all fields, attaches the id)
- Checks if `templateId` exists → if yes, renders from `TemplateCache`

---

#### STEP 3: Template Rendering (if applicable)

If `payload.templateId` is set:
```typescript
const compiled = this.templateCache.get("welcome-email");
normalized.html = this.templateEngine.render(compiled, { name: "Piyush" });
```

The `TemplateCache` is an **LRU Cache** (Least Recently Used):
- Max 100 compiled templates in memory
- On `get()`, it moves the item to the "most recently used" end
- On overflow, removes the oldest template
- Avoids re-compiling Handlebars templates on every send (expensive operation)

---

#### STEP 4: Enqueuing with Priority

```typescript
this.queue.enqueue({
  id, correlationId, payload, attempts: 0,
  enqueuedAt: new Date(),
  nextRetryAt: Date.now(),
  resolve,   // Promise callbacks for awaitResult mode
  reject
});
```

**The `EmailQueue` is a Priority Queue:**
- Stores jobs in a sorted array
- Sort order:
  1. `nextRetryAt` (earliest retry time first)
  2. Priority score: `high=0`, `normal=1`, `low=2`
  3. `enqueuedAt` (FIFO within same priority)

🔑 **Back-pressure:** If queue size ≥ `maxSize` (10,000), it throws `QueueFullError` immediately. This prevents out-of-memory crashes.

The emitter also fires `email.queued` event → `MetricsCollector` increments `totalQueued`.

---

#### STEP 5: QueueWorker Dequeues (Concurrently)

The `QueueWorker` starts 5 concurrent worker loops (configurable via `concurrency`):

```
Worker-1:  dequeue → deliver → dequeue → deliver → ...
Worker-2:  dequeue → deliver → dequeue → deliver → ...
Worker-3:  dequeue → deliver → dequeue → deliver → ...
Worker-4:  dequeue → deliver → dequeue → deliver → ...
Worker-5:  dequeue → deliver → dequeue → deliver → ...
```

Each worker runs an infinite loop:
- Tries to `dequeue()` a job
- If queue is empty → sleeps for `pollIntervalMs` (100ms)
- If job `nextRetryAt > Date.now()` → the job is "not ready yet" → skips
- Otherwise → passes job to `DeliveryEngine.deliver()`

---

#### STEP 6: Rate Limiter Check (Token Bucket Algorithm)

Before calling any provider, the `DeliveryEngine` calls:

```typescript
await this.rateLimiters.get(provider.name)?.acquire(job.correlationId);
```

**How the Token Bucket works:**
- Bucket starts full: `burstCapacity = 200` tokens
- Refills at: 100 tokens/second
- Each email send costs: 1 token
- If `mode = "wait"` → busy-waits up to 3s for a token to be available
- If `mode = "throw"` → immediately throws `RateLimitError`

> 💡 **Analogy:** Think of it like a vending machine with coins. You start with 200 coins. Each email uses 1 coin. Coins refill at 100/second. If you run out, you either wait for more coins (wait mode) or get an error (throw mode).

---

#### STEP 7: FallbackChain Picks a Provider

```typescript
const providers = this.fallbackChain.orderedAvailable();
```

`orderedAvailable()` returns all providers that are:
1. NOT blocked by their `CircuitBreaker` (circuit is not OPEN)
2. `isAvailable() === true`

The `DeliveryEngine` then tries each available provider in order.

---

#### STEP 8: CircuitBreaker Allows/Blocks

The `CircuitBreaker` has 3 states:

```
CLOSED ──(5 failures)──▶ OPEN ──(60s timeout)──▶ HALF_OPEN
  ▲                                                     │
  └──────────────(1 success)───────────────────────────┘
```

| State | Behavior |
|---|---|
| `CLOSED` | Normal — all requests pass through |
| `OPEN` | Provider is blocked — skip to next in FallbackChain |
| `HALF_OPEN` | One test request allowed — success → CLOSED, failure → OPEN again |

> 💡 **Analogy:** It's like a fuse box. When a wire (provider) has too many failures (surges), the fuse blows (circuit OPENS) to protect the rest of the system. After a cooldown (60 seconds), you try flipping the switch again (HALF_OPEN). If it works, great. If not, it blows again.

---

#### STEP 9: Provider Sends the Email

The three concrete providers in this SDK:

**SmtpProvider** (uses `nodemailer`):
```typescript
await this.transporter.sendMail({
  from: payload.from.email,
  to: payload.to.map(r => r.email).join(","),
  subject: payload.subject,
  html: payload.html
});
```

**AwsSesProvider** (uses `@aws-sdk/client-ses`):
```typescript
const command = new SendEmailCommand({
  Source: payload.from.email,
  Destination: { ToAddresses: payload.to.map(x => x.email) },
  Message: { Subject: { Data: payload.subject }, Body: { Html: { Data: payload.html } } }
});
await this.client.send(command);
```

**SendGridProvider** (uses `@sendgrid/mail`):
```typescript
await sendgrid.send({
  from: payload.from.email,
  to: payload.to.map(x => x.email),
  subject: payload.subject,
  html: payload.html
});
```

---

#### STEP 10: Events Emitted → Metrics Updated

After success:
```typescript
breaker?.recordSuccess();  // Circuit stays/goes CLOSED
return { ...result, attempts: attempt + 1, status: EmailStatus.SENT };
// → QueueWorker calls onProcessed → emitter.emitSent()
// → MetricsCollector increments totalSent for that provider
// → ConsoleLogger logs: {"event":"email.sent","messageId":"..."}
// → FileLogger appends to email.log
```

After failure:
```typescript
breaker?.recordFailure();  // May open circuit
const shouldRetry = this.retryPolicy.shouldRetry(error, attempt + 1);
```

---

#### STEP 11: RetryPolicy Decides

```typescript
shouldRetry(error, attempt):
  if (attempt >= maxAttempts) → false (exhausted)
  if (error.code === 400) → false (bad request — your fault, won't fix itself)
  if (error.code === 401) → false (auth failure — won't fix itself)
  if (error.code === 422) → false (validation error — won't fix itself)
  if (error.code === 429) → true  (rate limited — retry later)
  if (error.code >= 500)  → true  (server error — might recover)
  default                 → true  (unknown — optimistically retry)
```

**Delay Formula:**
```
delay = min(baseDelayMs × 2^attempt + random_jitter, maxDelayMs)
        = min(1000 × 2^0 + jitter, 30000)   // attempt 0: ~1s
        = min(1000 × 2^1 + jitter, 30000)   // attempt 1: ~2s
        = min(1000 × 2^2 + jitter, 30000)   // attempt 2: ~4s
```

🔑 **Why jitter?** Without jitter, all workers retry at the same time → thundering herd → overwhelms the recovering provider. Jitter randomizes the delays so retries are spread out.

---

#### STEP 12: Dead Letter Queue (on exhaustion)

If all retry attempts fail:
```typescript
this.dlq.add(job);   // Stored in DLQHandler.failedJobs[]
job.reject?.(error); // Rejects the promise if awaitResult was true
onError(error);      // Emits email.failed event
```

The DLQ stores failed jobs in memory. In production, you'd persist these to a database for manual inspection/replay.

---

---

## PART 3 — SYSTEM DESIGN DEEP DIVE

### 3.1 Scalability

**Current state (this SDK):** Vertical scaling within a single Node.js process.
- 5 concurrent workers (goroutine-style async loops)
- Queue max: 10,000 jobs
- Can handle bursts well within a single instance

**How to scale horizontally:**
1. Replace in-memory `EmailQueue` with **Redis** or **BullMQ**
2. Run multiple Node.js processes / containers
3. Each instance polls from the shared Redis queue
4. Workers in different machines pick up jobs independently

🔑 **Horizontal vs Vertical:**
- **Vertical:** Make the machine bigger (more RAM, CPU)
- **Horizontal:** Add more machines

This SDK supports horizontal scaling via the **extensibility design** — the `EmailQueue` can be swapped for a Redis-backed queue since the interface is clean.

---

### 3.2 Load Balancing

Not directly in this SDK (it's a library, not a server). But at the deployment layer:
- Multiple instances of the app using this SDK can be served via a load balancer (Nginx, AWS ALB)
- The shared queue (Redis) acts as the work distributor itself

---

### 3.3 Rate Limiting — Token Bucket Algorithm

**Your implementation:** `src/delivery/RateLimiter.ts`

```
Bucket capacity: 200 (burstCapacity)
Refill rate: 100 tokens/second
Each send: costs 1 token
```

| Scenario | Behavior |
|---|---|
| 200 emails in 1 second | OK — uses all burst capacity |
| 201 emails in 1 second | 201st waits ~10ms for refill |
| Sustained 100 emails/sec | Sustainable forever |
| Sustained 101 emails/sec | Slowly draining — eventually throws |

**Why Token Bucket over Fixed Window?**
- Fixed window: reset every second. If 1000 req at 0.99s + 1000 at 1.01s → 2000 req pass in 0.02s window → spike escapes
- Token Bucket: smooth. No matter when you send, you can only consume at the configured rate.

---

### 3.4 Queue System

**Your implementation:** `src/queue/EmailQueue.ts` — **In-memory Priority Queue**

| Feature | This SDK | Production Alternative |
|---|---|---|
| Persistence | ❌ (lost on crash) | ✅ Redis, PostgreSQL, Kafka |
| Multi-process | ❌ (single process) | ✅ BullMQ, RabbitMQ, SQS |
| Priority | ✅ (high/normal/low) | ✅ All support priority |
| Back-pressure | ✅ (QueueFullError) | ✅ Consumer lag monitoring |
| Dead Letter Queue | ✅ (in-memory DLQ) | ✅ Persisted DLQ |

---

### 3.5 Retry Mechanism — Exponential Backoff with Jitter

> Explained in Step 11 above. Key formula:
```
delay = min(baseDelayMs × 2^attempt + jitter, maxDelayMs)
```

- **Exponential:** doubles on each failure (1s → 2s → 4s → 8s...)
- **Backoff:** gives the provider time to recover
- **Jitter:** prevents all workers retrying simultaneously
- **Non-retryable codes (400, 401, 422):** Don't retry — waste of resources

---

### 3.6 Idempotency

🔑 This is a critical concept. In email systems:
- **Problem:** Network failure after provider accepts email but before SDK gets response → SDK retries → email sent twice
- **Solution:** Generate a stable `messageId` upfront and pass it to the provider
- **SES Idempotency:** Use `ClientToken` to deduplicate
- **Your SDK:** Generates `msg_<timestamp>_<random6chars>` as messageId before sending

> ⚠️ **Viva trap:** "How do you prevent duplicate emails on retry?" — Mention idempotency keys passed to providers.

---

### 3.7 Fault Tolerance

This SDK implements fault tolerance at multiple layers:

```
Layer 1: Retry (transient failures)
Layer 2: Fallback Chain (provider failures)
Layer 3: Circuit Breaker (cascade prevention)
Layer 4: Dead Letter Queue (permanent failures)
Layer 5: Back-pressure (memory protection)
```

🔑 **Key phrase:** "Defense in depth — multiple independent layers, so failure of one layer doesn't bring down the system."

---

### 3.8 High Availability

- **Multiple providers** configured → if primary (SES) goes down, fallback (SMTP) takes over
- **CircuitBreaker** ensures that a dead provider is bypassed quickly (fast fail)
- **No single point of failure** at the SDK level

For full HA at the infrastructure level:
- Deploy multiple app instances
- Use shared Redis queue
- Use multi-region SES or multiple SendGrid accounts

---

### 3.9 Logging & Monitoring

**Your implementation uses the Observer Pattern:**

```
EmailEventEmitter (Observable)
        │
        ├── ConsoleLogger (Observer) → prints JSON to stdout
        ├── FileLogger (Observer)    → appends JSON to email.log
        └── MetricsCollector (Observer) → updates counters & latencies
```

**Events emitted:**
| Event | When |
|---|---|
| `email.queued` | Job added to queue |
| `email.sent` | Provider accepted successfully |
| `email.failed` | All retries exhausted |
| `email.retrying` | About to retry with delay info |
| `email.bounced` | Hard bounce from provider |

**MetricsCollector tracks:**
- `totalQueued` — all-time counter
- `totalSent` / `totalFailed` — within retention window (1 hour default)
- `byProvider.sent`, `byProvider.failed` — per-provider breakdown

> 💡 **Analogy:** The EventEmitter is like a radio tower. It broadcasts on a frequency. ConsoleLogger, FileLogger, and MetricsCollector are like different radios tuned to that frequency — they all receive the same broadcast independently.

---

---

## PART 4 — ARCHITECTURE DIAGRAM

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

### Component Responsibilities — One Line Each

| Component | Role |
|---|---|
| `SDKBuilder` | Wires all dependencies. Fluent API. Returns `EmailSDK`. |
| `EmailSDK` | Public API. Orchestrates send, bulk, templates, events, health. |
| `EmailQueue` | Priority queue. Decouples producers from consumers. |
| `QueueWorker` | 5 async loops that continuously drain the queue. |
| `DLQHandler` | Graveyard for permanently failed jobs. |
| `DeliveryEngine` | Retry logic + provider selection + rate limiting. |
| `FallbackChain` | Returns ordered list of non-blocked available providers. |
| `CircuitBreaker` | State machine per provider: CLOSED → OPEN → HALF_OPEN. |
| `RateLimiter` | Token bucket. Controls send speed per provider. |
| `RetryPolicy` | Decides if/when to retry. Exponential backoff + jitter. |
| `SmtpProvider` | Wraps nodemailer for any SMTP server. |
| `AwsSesProvider` | Wraps AWS SDK's SESClient. |
| `SendGridProvider` | Wraps @sendgrid/mail. |
| `MockProvider` | Fake provider with configurable failure rate. For testing. |
| `EmailProviderFactory` | Factory: creates provider from string config type. |
| `ProviderRegistry` | Registry: name → provider instance (Map). |
| `EmailEventEmitter` | Typed event bus. Extends Node.js EventEmitter. |
| `ConsoleLogger` | Attaches to emitter. Logs JSON to stdout. |
| `FileLogger` | Attaches to emitter. Appends JSON lines to a file. |
| `MetricsCollector` | Tracks counts in a sliding window (retention: 1h). |
| `HealthChecker` | Calls healthCheck() on all providers in parallel. |
| `HandlebarsEngine` | Compiles+renders Handlebars templates. |
| `MustacheEngine` | Compiles+renders Mustache templates. |
| `TemplateCache` | LRU cache: avoids re-compiling templates on every send. |
| `TemplateFactory` | Creates the correct template engine type. |
| `SDKError` | Base error class with code + correlationId. |
| `ProviderError` | extends SDKError. Adds providerName + retryable flag. |
| `QueueFullError` | Thrown when queue reaches maxSize. |
| `RateLimitError` | Thrown when rate limit exceeded in "throw" mode. |

---

---

## PART 5 — DATABASE DESIGN

### Current State: In-Memory (No Persistence)

Your SDK currently stores everything in memory:
- `EmailQueue` → Array of `QueueJob` objects
- `DLQHandler` → Array of failed `QueueJob` objects
- `MetricsCollector` → Array of `MetricPoint` objects
- `TemplateCache` → `Map<string, compiled>`

**This is intentional for an SDK** — the consuming application owns the database.

---

### Production Database Schema (What You'd Add)

#### Option A: PostgreSQL (Relational)

**Why SQL for email systems?**
- Strong ACID guarantees (no duplicate processing)
- Easy to query "all failed emails from last hour"
- Reliable transactions for job status updates

```sql
-- Email Jobs Table
CREATE TABLE email_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id  UUID NOT NULL,
  status          VARCHAR(20) CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'retrying')),
  priority        VARCHAR(10) CHECK (priority IN ('high', 'normal', 'low')) DEFAULT 'normal',
  from_email      VARCHAR(255) NOT NULL,
  to_emails       JSONB NOT NULL,             -- ["a@x.com", "b@x.com"]
  cc_emails       JSONB,
  bcc_emails      JSONB,
  subject         VARCHAR(998) NOT NULL,       -- RFC 5321 limit
  html_body       TEXT,
  text_body       TEXT,
  template_id     VARCHAR(100),
  template_data   JSONB,
  metadata        JSONB,
  attempts        INT DEFAULT 0,
  max_attempts    INT DEFAULT 3,
  enqueued_at     TIMESTAMPTZ DEFAULT NOW(),
  next_retry_at   TIMESTAMPTZ DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  provider_used   VARCHAR(50),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_jobs_status_retry ON email_jobs (status, next_retry_at);
CREATE INDEX idx_email_jobs_priority ON email_jobs (priority);
CREATE INDEX idx_email_jobs_correlation ON email_jobs (correlation_id);

-- Email Events Table (audit trail)
CREATE TABLE email_events (
  id              BIGSERIAL PRIMARY KEY,
  job_id          UUID REFERENCES email_jobs(id),
  event_name      VARCHAR(50) NOT NULL,       -- 'email.sent', 'email.failed', etc.
  provider        VARCHAR(50),
  attempt         INT,
  delay_ms        INT,
  reason          TEXT,
  occurred_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Email Templates Table
CREATE TABLE email_templates (
  id              VARCHAR(100) PRIMARY KEY,   -- 'welcome-email', 'otp-template'
  engine          VARCHAR(20) NOT NULL,       -- 'handlebars', 'mustache'
  source          TEXT NOT NULL,              -- raw template string
  compiled_hash   VARCHAR(64),               -- SHA-256 of source (cache busting)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Provider Health History Table
CREATE TABLE provider_health_log (
  id              BIGSERIAL PRIMARY KEY,
  provider_name   VARCHAR(50) NOT NULL,
  status          VARCHAR(20),               -- 'UP', 'DOWN', 'DEGRADED'
  latency_ms      INT,
  checked_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### Option B: Redis (for Queue + Cache only)

```
ZSET email_queue     → score=nextRetryAt, member=job_id
HASH email_job:{id}  → all job fields as hash
LIST email_dlq       → failed job IDs
HASH templates       → template_id → compiled JSON
```

**Trade-off:**
- Redis = fast (microsecond reads), but volatile without persistence
- PostgreSQL = slower, but durable and queryable

**Best Practice in Production:** Use both
- Redis for the live queue (speed)
- PostgreSQL for audit trail and DLQ (durability)

---

### Trade-offs: SQL vs NoSQL for Email

| Concern | SQL (PostgreSQL) | NoSQL (MongoDB/DynamoDB) |
|---|---|---|
| ACID for dedup | ✅ Strong | ⚠️ Eventual |
| Query flexibility | ✅ Rich SQL | ⚠️ Limited |
| Schema evolution | ⚠️ Migrations | ✅ Flexible |
| Scale (write heavy) | ⚠️ Vertical | ✅ Horizontal |
| Analytics queries | ✅ Native SQL | ⚠️ Aggregation frameworks |

**Verdict:** For a billing/transactional email system → **PostgreSQL**. For a high-throughput notification system → **Hybrid (Redis + DynamoDB)**.

---

---

## PART 6 — OPTIMIZATION & TRADE-OFFS

### Performance Optimizations

#### 1. LRU Template Cache
- **Problem:** `Handlebars.compile()` parses the template string every time. Expensive for 10k emails/min.
- **Solution:** `TemplateCache` stores compiled templates. Hit the cache → skip compilation entirely.
- **Your code:** `src/templates/TemplateCache.ts` — uses `Map` with LRU eviction at max 100 entries.

#### 2. Concurrency (5 Workers)
- **Problem:** Sequential processing is slow.
- **Solution:** 5 `async/await` loops running concurrently in the same Node.js event loop.
- **No threads needed** — Node.js I/O is non-blocking. Each worker awaits the I/O, allowing others to proceed.
- **Tune for your workload:** For CPU-bound work, use worker threads. For I/O-bound (HTTP calls to providers) → async concurrency is optimal.

#### 3. Priority Queue
- **Ensures OTPs and auth emails go first** — critical for user experience.
- **Newsletters wait** — acceptable since there's no urgency.

#### 4. Sliding Window Metrics (MetricsCollector)
- **Problem:** Keeping all-time data wastes memory.
- **Solution:** `compact()` removes data points older than `retentionMs` (1 hour default).
- After 1 hour, old data is automatically garbage collected.

---

### Cost Optimizations

- **Token Bucket prevents overage charges** — providers charge per email. Staying within limits prevents extra fees.
- **SES as primary** — AWS SES is dramatically cheaper than SendGrid at scale ($0.10/1000 vs $15/1000).
- **SMTP as fallback** — nearly free if self-hosting.

---

### Latency Improvements

| Technique | Latency Gain |
|---|---|
| Template Cache hit | Saves 5-50ms (compile time) |
| RateLimiter "wait" mode | Avoids round-trip retry |
| Async queue | Returns instantly to caller; delivery is background |
| CircuitBreaker fast-fail | Skips 30s timeout on dead providers |
| Jitter in retry | Prevents thundering herd |

---

### Caching Strategies

| What | Cache | Why |
|---|---|---|
| Compiled templates | In-memory LRU (TemplateCache) | CPU expensive to recompile |
| Provider health status | In-memory (HealthChecker) | Avoid constant health pings |
| Rate limiter tokens | In-memory (RateLimiter) | Sub-millisecond check |
| Queue jobs | In-memory Array (EmailQueue) | Speed; persisted in prod |

---

---

## PART 7 — "WHAT IF WE REMOVE THIS?" QUESTIONS

### ❌ What if we remove the Queue (`EmailQueue`)?

**What breaks:**
- `sdk.send()` calls the provider directly and synchronously
- 10,000 concurrent emails → 10,000 simultaneous HTTP connections to SES
- Providers reject most requests with 429 (rate limit)
- Node.js event loop gets overwhelmed → entire app slows down
- A single provider timeout blocks the calling thread

**Impact:** System becomes fragile under any meaningful load. OTPs and newsletters compete for the same connection pool.

> 💡 **Analogy:** A post office without a sorting queue. Every person hands their letter directly to the delivery truck. The truck gets overwhelmed and starts dropping letters.

---

### ❌ What if there is no Rate Limiting (`RateLimiter`)?

**What breaks:**
- Burst of 1000 emails → provider returns 429 Too Many Requests
- Must retry → wastes network + CPU
- Retries may cause more 429s → cascade of retries
- Provider may ban your account/IP for abuse

**Impact:** Higher cost, possibility of account suspension, retry storms.

---

### ❌ What if retries are removed (`RetryPolicy`)?

**What breaks:**
- First transient failure (e.g., 503 from provider for 2 seconds) → email permanently lost
- User never receives OTP → logs out, bad UX
- No visibility that it even failed (without DLQ)
- Delivery success rate drops dramatically under real-world conditions

**Impact:** Unreliable. In production email systems, 5-15% of sends need at least 1 retry due to network conditions.

---

### ❌ What if no Circuit Breaker (`CircuitBreaker`)?

**What breaks:**
- Provider A is completely down (503 always)
- Every email attempt → tries provider A → waits timeout → fails → retries
- 3 retries × 30s timeout = 90 seconds wasted per email
- Queue backs up with jobs all waiting on a dead provider
- Memory grows → system crashes

**Impact:** A single bad provider brings down the entire email system, even if a healthy fallback exists.

> 💡 **Analogy:** Without a circuit breaker, it's like a short-circuit in your home. Without the fuse box, the entire electrical system burns. The fuse (circuit breaker) isolates the bad wire.

---

### ❌ What if there's no Load Balancer (at infrastructure level)?

**What breaks:**
- All traffic hits one server instance
- If that server crashes → zero availability
- Can't scale horizontally
- Hot spots — one instance gets all traffic while others sit idle

**Impact:** No horizontal scalability, single point of failure.

---

### ❌ What if no Logging/Monitoring (EventEmitter/MetricsCollector)?

**What breaks:**
- An email fails silently — you have no idea
- No audit trail for debugging ("did user@gmail.com receive their OTP?")
- No visibility into which provider is struggling
- Cannot alert on anomalies (e.g., failure rate suddenly spikes to 50%)
- Debugging production issues is guesswork

**Impact:** A black box system. SLA violations go undetected. On-call engineer has no data to debug with.

---

### ❌ What if no FallbackChain?

**What breaks:**
- Primary provider goes down → all emails fail immediately
- Single provider dependency → availability tied to that provider's uptime
- SES has 99.9% uptime. But 0.1% downtime = 8.7 hours/year of email failures

**Impact:** Lower availability. Every provider outage = your system's outage.

---

### ❌ What if no DLQ?

**What breaks:**
- Failed jobs are simply discarded after retries
- No way to know what failed and why
- No way to manually replay failed jobs
- In a transactional system (invoices, legal notices), this is a compliance violation

**Impact:** Data loss. Unrecoverable failures. Unhappy customers who never got their emails.

---

---

## PART 8 — INTERVIEW Q&A (20+ Questions)

### Basic / Conceptual

**Q1: What is this SDK and why was it built?**
> A provider-agnostic TypeScript library for reliable email delivery. Built to solve vendor lock-in, handle transient failures gracefully, and provide visibility into email delivery pipelines. Instead of coupling your app to one provider, the SDK gives a unified interface with built-in retries, fallbacks, queuing, and observability.

---

**Q2: Why is there an abstraction layer (`IEmailProvider`) instead of calling SES directly?**
> Two reasons: (1) **Strategy Pattern** — you can swap providers without changing any business logic. Adding Mailgun tomorrow means implementing `IEmailProvider` and registering it, nothing else changes. (2) **Testability** — `MockProvider` implements the same interface, enabling full unit testing without real network calls.

---

**Q3: Why use a Queue? Why not call the provider directly on `sdk.send()`?**
> The queue decouples producers (caller) from consumers (workers). Benefits: (1) Returns immediately to the caller — no blocking. (2) Absorbs traffic spikes — queue buffer prevents provider overload. (3) Enables priority ordering — OTPs go before newsletters. (4) Enables retries in background — the caller doesn't wait for retries. (5) Back-pressure — if queue is full, throws `QueueFullError` instead of quietly running out of memory.

---

**Q4: Explain the Token Bucket algorithm.**
> You have a bucket that holds `burstCapacity` tokens. Tokens refill at `tokensPerSecond`. Each email send costs 1 token. If the bucket is empty, wait for refill (wait mode) or reject (throw mode). This allows short bursts (up to burst capacity) while enforcing a sustainable average rate. Better than fixed windows because it's inherently smooth — there's no boundary exploit.

---

**Q5: What is a Circuit Breaker and when does it open?**
> A Circuit Breaker is a state machine (CLOSED → OPEN → HALF_OPEN → CLOSED) that stops sending requests to a failing provider. In this SDK: after 5 consecutive failures, the circuit opens. The provider is bypassed for 60 seconds. After that, one test request is allowed (HALF_OPEN). If it succeeds, the circuit closes. If it fails, it opens again. This prevents cascading failures and wasted timeout waits on dead providers.

---

**Q6: What is exponential backoff with jitter?**
> Exponential backoff doubles the delay on each retry: 1s, 2s, 4s, 8s... This gives the failing provider time to recover. Jitter adds random noise (up to 250ms) to prevent multiple workers from retrying simultaneously (thundering herd problem). Formula: `delay = min(baseDelayMs × 2^attempt + random(0,250), maxDelayMs)`.

---

**Q7: Why do you NOT retry on HTTP 400 or 401 but DO retry on 500 or 429?**
> 400 (Bad Request) and 401 (Unauthorized) are client errors — the problem is with our request, not the server. No amount of retrying will fix a malformed email address or wrong API key. 500 (Server Error) means the provider had an internal problem — likely temporary and worth retrying. 429 (Too Many Requests) means we're going too fast — back off and retry when the window resets.

---

**Q8: What is the Dead Letter Queue and why is it important?**
> The DLQ is a storage for jobs that have exhausted all retry attempts and cannot be delivered. It's a safety net — instead of silently discarding failed messages, the DLQ preserves them for manual inspection, debugging, and potential replay. In production systems, DLQ messages might trigger an alert to an on-call engineer.

---

**Q9: What is the Observer Pattern and how is it used here?**
> The Observer Pattern defines a one-to-many relationship: when state changes, all interested parties are notified. In this SDK: `EmailEventEmitter` is the observable (Subject). `ConsoleLogger`, `FileLogger`, and `MetricsCollector` are observers — they call `.attach(emitter)` to subscribe. When an email event occurs, the emitter broadcasts to all subscribers without knowing who they are. This decouples core delivery logic from logging and metrics concerns.

---

**Q10: What is Dependency Injection and why use a Builder Pattern?**
> DI means providing an object's dependencies externally instead of creating them internally. `EmailSDK` gets its queue, engine, logger, etc. injected via the constructor — it doesn't create them itself. This makes testing easy (inject mocks) and configuration flexible. The `SDKBuilder` solves the problem of complex construction: when a class needs 10+ dependencies, a fluent builder makes setup readable. The `build()` method wires everything together as the composition root.

---

### Intermediate / System Design

**Q11: How does the FallbackChain work?**
> `FallbackChain` holds an ordered list of providers. `orderedAvailable()` filters to providers whose `CircuitBreaker` is NOT open (not in OPEN state) and whose `isAvailable()` returns true. The `DeliveryEngine` iterates through this list, trying each in order. If SES fails, it tries SMTP. If SMTP also fails, it tries SendGrid. This provides multi-provider High Availability.

---

**Q12: How do you scale this SDK to handle millions of emails per day?**
> 1. Replace `EmailQueue` (in-memory) with **Redis/BullMQ** or **SQS** — enables multi-process/multi-machine horizontal scaling. 2. Deploy multiple app instances — each polls from the shared queue independently. 3. Increase `concurrency` per instance based on vCPUs and I/O capacity. 4. Add more provider accounts (SES has per-account send limits — use multiple accounts/regions). 5. Add observability with Prometheus + Grafana for real-time metrics. 6. Use a CDN for template assets (images, CSS) to reduce provider payload size.

---

**Q13: How do you ensure an email is not sent twice (idempotency)?**
> Generate a stable `messageId` (in this SDK: `msg_<timestamp>_<random>`) before the first send attempt. Pass this same ID as the `ClientToken` or `MessageId` to the provider on every retry. Most providers deduplicate on this ID within a time window. Additionally, track email status in a database — before processing any job, check if it's already `SENT`.

---

**Q14: How does the LRU Template Cache work?**
> `TemplateCache` uses a `Map` (which preserves insertion order in JS). On `get()`: remove and re-insert the key to mark it as most recently used. On `set()`: if cache exceeds `maxSize` (100), remove the first (oldest) key from the map. This is O(1) LRU. Compiled templates are expensive to generate (Handlebars parsing), so caching them avoids repeated CPU work.

---

**Q15: What are the design patterns used in this project?**
| Pattern | Where Used |
|---|---|
| Strategy | `IEmailProvider` — swap SMTP/SES/SendGrid interchangeably |
| Factory | `EmailProviderFactory`, `TemplateFactory` |
| Builder | `SDKBuilder` — fluent construction of EmailSDK |
| Observer | `EmailEventEmitter` + ConsoleLogger/FileLogger/MetricsCollector |
| Dependency Injection | All deps injected into `EmailSDK` constructor |
| Circuit Breaker | `CircuitBreaker` state machine per provider |
| Chain of Responsibility | `FallbackChain` — try each handler in order |
| Template Method | `BaseProvider.send()` → calls abstract `doSend()` |

---

### Advanced / Deep Dive

**Q16: How would you handle the thundering herd problem at 10x traffic?**
> 1. Jitter in retries (already implemented) — spread retry storms. 2. Rate Limiter per provider — cap outgoing rate regardless of queue size. 3. Circuit Breaker — stop hammering a failing provider immediately. 4. Distributed rate limiting with Redis (for multi-process) instead of per-process token buckets. 5. Queue-based back-pressure — reject at ingestion if overloaded rather than letting jobs pile up.

---

**Q17: How to avoid spam classification?**
> 1. **SPF/DKIM/DMARC** — email authentication records in DNS that prove you're authorized to send from your domain. 2. **Dedicated sending domain** — e.g., `mail.yourapp.com` instead of your main domain. 3. **Consistent sending patterns** — sudden spikes trigger spam filters. 4. **Low bounce rate** — validate email addresses (regex + MX record lookup) before queuing. 5. **Unsubscribe headers** — include `List-Unsubscribe` header in newsletters. 6. **Warm-up IP** — new IPs should ramp up volume gradually.

---

**Q18: What if the app crashes while emails are in the in-memory queue?**
> With the current implementation, all queued but undelivered jobs are lost. The fix: persist jobs to PostgreSQL/Redis before enqueuing to memory. On startup, read unprocessed jobs from the database and re-enqueue them. This is the "outbox pattern" — write to DB and queue atomically. This is listed in your Roadmap: `Database Persistence: Move the queue from memory to Redis or PostgreSQL`.

---

**Q19: What is the difference between your `CircuitBreaker` and just adding a `try/catch`?**
> `try/catch` only handles the current failure. Circuit Breaker tracks state over time across multiple requests. After 5 failures, it stops sending requests to that provider entirely — it doesn't even try. This saves: (1) the timeout wait on every failed attempt, (2) resources wasted on guaranteed-to-fail requests. It's proactive failure isolation, not just reactive error handling.

---

**Q20: How would you add webhook support for email events (opened, clicked)?**
> Providers like SendGrid and SES support webhooks — they POST to your endpoint when an email is opened, clicked, or bounced. Your SDK would need: (1) An HTTP server endpoint (e.g., Express route `/webhooks/email`). (2) Parse the provider-specific webhook payload. (3) Look up the `messageId` in your database. (4) Update the email status and emit the appropriate event (`email.opened`, `email.clicked`). This closes the feedback loop — you know not just that the email was sent, but that it was actually engaged with.

---

**Q21: What happens if two workers dequeue the same job?**
> In the current in-memory implementation, this cannot happen. `Array.shift()` in `EmailQueue.dequeue()` is synchronous and JS is single-threaded — only one worker can execute it at a time. In a distributed system with Redis, you'd use `LPOP` which is atomic, or BullMQ's job locking mechanism to prevent concurrent processing of the same job.

---

**Q22: How would you design this for multi-tenancy (serving multiple businesses)?**
> 1. Add `tenantId` to `EmailPayload` and `SDKConfig`. 2. Separate `RateLimiter` instances per tenant (already done per provider — extend to per tenant/provider). 3. Per-tenant provider credentials and sending domains. 4. Separate DLQ per tenant. 5. Database rows scoped by `tenant_id` with row-level security. 6. Tenant-specific template namespacing.

---

---

## PART 9 — EDGE CASES & FAILURE SCENARIOS

### Scenario 1: Email Provider Goes Down

**Flow:**
1. `AwsSesProvider.doSend()` throws 503
2. `DeliveryEngine` calls `breaker.recordFailure()` → failure count: 1/5
3. `RetryPolicy.shouldRetry(503, attempt)` → true (server error)
4. Wait `delay` ms with jitter
5. Repeat attempts. After 5 failures → CircuitBreaker opens
6. `FallbackChain.orderedAvailable()` → skips SES (circuit OPEN)
7. Returns SMTP provider → email delivered via fallback
8. After 60 seconds, SES circuit goes HALF_OPEN → test request
9. If SES recovered → circuit CLOSES, traffic moves back to SES

---

### Scenario 2: Duplicate Emails

**Risk:** Network timeout after provider accepts email → SDK retries → duplicate
**Mitigation in this SDK:**
- Stable `messageId` generated once (`msg_<timestamp>_<random>`)
- Pass to provider as `MessageId`/`ClientToken` (SES supports this)
- Providers deduplicate within a 10-minute window on same ID

**Production mitigation:**
- Database-level `UNIQUE(messageId, provider)` constraint
- Check status before processing: if already `SENT` → skip

---

### Scenario 3: Delayed Delivery

**Causes:**
- Queue congested (high traffic) → jobs sit in queue longer
- Retry delays (exponential backoff) → up to 30 seconds per retry
- Provider slow (SMTP handshake, SES regional delay)

**Detection:**
- `MetricsCollector.getStats()` shows high `avgLatencyMs`
- `email.retrying` events indicate delays
- Alert if `timestamp.sent - timestamp.queued > threshold`

**Mitigation:**
- `priority: "high"` for OTPs → they skip the queue to the front
- Increase `concurrency` for high-throughput scenarios

---

### Scenario 4: Invalid Email Addresses

**Current state:** SMTP/SES rejects at provider level → returns 400/422
**`RetryPolicy.shouldRetry(400)` → false** → immediately sent to DLQ
**Best practice to add:**
- Validate regex before queuing: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- MX record lookup: does the domain have email servers?
- Flag as invalid → skip the entire queue/retry cycle

---

### Scenario 5: High Traffic Spikes (e.g., flash sale)

**Flow:**
1. App sends 50,000 emails via `sendBulk()`
2. First 10,000 → enqueued (maxSize limit hit)
3. Job 10,001 → `QueueFullError` thrown to caller (back-pressure)
4. App handles: queue the rest in its own database, retry when queue drains
5. Workers process at rate: 5 workers × 100 emails/sec = 500 emails/sec
6. Queue drains in 20 seconds → more jobs can be submitted

**Key insight:** Back-pressure (`QueueFullError`) is better than silently accepting all 50,000 jobs and running out of memory.

---

### Scenario 6: Circuit Breaker False Positive

**Scenario:** Network hiccup causes 5 failures in 1 second → circuit opens → healthy provider is blocked
**Mitigation:**
- Higher failure threshold (e.g., 10 instead of 5)
- Failure counting window (e.g., only count failures in last 60s)
- Health check endpoint to verify before circuit opens

---

---

## PART 10 — ADVANCED IMPROVEMENTS

### 10.1 Microservices vs Monolith

**Current state:** SDK (library) — runs inside the caller's process (embedded monolith style)

**Microservices approach:**
```
Email Service (standalone microservice)
  │
  ├── HTTP/gRPC API: POST /send, POST /bulk, GET /health, GET /stats
  ├── Consumer: reads from Kafka/SQS topic
  ├── Internal queue: BullMQ + Redis
  ├── Provider workers: separate pool
  └── Database: PostgreSQL for persistence
```

**When to use microservice:**
- Multiple apps need email (not just one Node.js app)
- Need to scale email independently from app servers
- Different teams own different services
- High email volume (millions/day)

**Trade-off of microservices:**
- Network latency between caller and email service
- Need service discovery, load balancer, health checks
- More operational complexity

---

### 10.2 Multi-Region Deployment

```
Region: us-east-1
  └── Email Service + SES (primary)
  
Region: eu-west-1
  └── Email Service + SES (primary for GDPR — EU data stays in EU)
  
Region: ap-south-1
  └── Email Service + SES (Asia users — lower latency)
```

**Benefits:**
- GDPR compliance (data residency)
- Lower latency for global users
- Regional failover (if us-east-1 goes down, failover to eu-west-1)

**Implementation:**
- Route emails by sender domain/tenant region
- Use Route 53 (AWS) or Cloudflare for DNS-based routing
- Redis Cluster for shared job state across regions

---

### 10.3 Email Analytics (Open/Click Tracking)

```
Sending an email with tracking:
  1. Replace all links with tracking redirect:
     https://your.track.server/t/click?id=<jobId>&url=<original>
  2. Add 1×1 invisible tracking pixel:
     <img src="https://your.track.server/t/open?id=<jobId>" />

Tracking server receives:
  - GET /t/open?id=xyz → mark email as OPENED → redirect (302)
  - GET /t/click?id=xyz&url=... → mark link as CLICKED → redirect to original URL

Storage:
  CREATE TABLE email_tracking_events (
    id         BIGSERIAL,
    job_id     UUID,
    event      TEXT,  -- 'opened', 'clicked'
    user_agent TEXT,
    ip         INET,
    url        TEXT,
    occurred_at TIMESTAMPTZ
  );
```

**Privacy note:** Apple Mail Privacy Protection (MPP) pre-fetches emails → false "opened" signals. Use click tracking as more reliable signal.

---

### 10.4 Template Engine Improvements

**Current:** Handlebars + Mustache (string templates)

**Improvements:**
1. **MJML support** — Mobile-responsive email HTML framework. MJML compiles to cross-client HTML. Write `<mj-section>` instead of hack-y HTML tables.
2. **React Email** — Write email templates as React components (`react-email` library), render to HTML server-side.
3. **Template versioning** — Store multiple versions in DB, enable A/B testing.
4. **Preview endpoint** — API to preview rendered template with sample data before sending.
5. **Nested partials** — Handlebars partials for reusable components (header, footer, button).

---

### 10.5 Other Improvements (Your Roadmap)

```
✅ Currently completed:
- Provider abstraction (SMTP/SES/SendGrid/Mock)
- Queue + back-pressure
- Retry with backoff + jitter  
- Circuit Breaker
- Rate Limiter (Token Bucket)
- Template engine (Handlebars/Mustache) + LRU cache
- Observer pattern (events + logging + metrics)
- DI + Builder pattern
- DLQ
- Health checking

🔲 Roadmap (next steps):
1. Database persistence (PostgreSQL/Redis queue)
2. Webhook handler (opened/clicked/bounced from providers)
3. Attachment support (S3 presigned URL links)
4. Email validation before queuing (regex + MX lookup)
5. Multi-region support
6. Click/open tracking pixel
7. API server (expose SDK as HTTP service)
8. Admin dashboard (DLQ management, retry jobs, metrics visualization)
9. gRPC interface for high-performance internal usage
10. Distributed tracing (OpenTelemetry integration via correlationId)
```

---

---

## QUICK REVISION CHEAT SHEET

> 🔑 Memorize these before your viva

### Design Patterns Used
| Pattern | Class |
|---|---|
| Strategy | `IEmailProvider` / providers |
| Factory | `EmailProviderFactory`, `TemplateFactory` |
| Builder | `SDKBuilder` |
| Observer | `EmailEventEmitter` |
| DI / IoC | `EmailSDK` constructor |
| Circuit Breaker | `CircuitBreaker` |
| Chain of Responsibility | `FallbackChain` |
| Template Method | `BaseProvider.send()` → `doSend()` |

### Key Algorithms
| Algorithm | Class | Config |
|---|---|---|
| Token Bucket | `RateLimiter` | 100/sec, burst 200 |
| Exponential Backoff + Jitter | `RetryPolicy` | base=1s, max=30s |
| LRU Eviction | `TemplateCache` | max 100 templates |
| Priority Queue | `EmailQueue` | high/normal/low |
| State Machine | `CircuitBreaker` | 5 fails → OPEN, 60s → HALF_OPEN |

### Providers & External Dependencies
| Provider | npm Package | Protocol |
|---|---|---|
| SMTP | `nodemailer` | SMTP |
| AWS SES | `@aws-sdk/client-ses` | HTTPS/REST |
| SendGrid | `@sendgrid/mail` | HTTPS/REST |

### Error Hierarchy
```
Error
  └── SDKError (code, message, correlationId)
        ├── ProviderError (providerName, retryable, statusCode)
        ├── QueueFullError (QUEUE_FULL)
        └── RateLimitError (RATE_LIMIT)
```

### `EmailStatus` Lifecycle
```
QUEUED → PROCESSING → SENT
                   ↘
              RETRYING → (back to PROCESSING)
                       ↘
                   FAILED → DLQ
```

### Key Numbers (defaults in SDKBuilder)
| Config | Default Value |
|---|---|
| Queue max size | 10,000 jobs |
| Queue concurrency | 5 workers |
| Queue poll interval | 100ms |
| Retry max attempts | 3 |
| Retry base delay | 1,000ms |
| Retry max delay | 30,000ms |
| Jitter | enabled (up to 250ms) |
| CB failure threshold | 5 failures |
| CB recovery time | 60,000ms (60s) |
| Rate limit | 100/sec |
| Burst capacity | 200 tokens |
| Template cache size | 100 entries |
| Metrics retention | 3,600,000ms (1 hour) |

### One-Line Summary for Each Component (Say in Viva)

- **EmailSDK:** "The public API facade that orchestrates all internal components."
- **SDKBuilder:** "Fluent builder that acts as the composition root for all dependencies."
- **EmailQueue:** "Priority queue with back-pressure — heart of async processing."
- **QueueWorker:** "5 concurrent async loops — the engine that drains the queue."
- **DeliveryEngine:** "The brain — applies all resilience patterns (retry, rate-limit, fallback)."
- **FallbackChain:** "Ordered list of providers; skips open circuits to find a healthy one."
- **CircuitBreaker:** "3-state machine per provider to prevent cascading failures."
- **RateLimiter:** "Token bucket that enforces speed limits to prevent provider bans."
- **RetryPolicy:** "Decides what to retry (server errors yes, client errors no) and when."
- **DLQHandler:** "Preserves permanently failed jobs for inspection and replay."
- **EmailEventEmitter:** "Broadcasts typed events to all attached observers."
- **MetricsCollector:** "Sliding window metrics: sent/failed counts per provider."
- **TemplateCache:** "LRU cache of compiled templates to avoid re-parsing on every send."

---

*Good luck with your viva, Piyush! You built a genuinely impressive, production-grade SDK. Own it confidently. 🚀*
