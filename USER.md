# Email SDK — User Guide (`USER.md`)

This guide explains how to **install, configure, and use** the Email SDK from a developer’s perspective (the same way you’d integrate it into an application).

---

## Requirements

- Node.js (recommended: current LTS)
- npm

---

## Install

```bash
npm install
```

---

## Environment configuration

1. Copy the example env file and fill credentials as needed:

```bash
cp .env.example .env
```

2. Providers supported:
- **SMTP**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- **AWS SES**: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **SendGrid**: `SENDGRID_API_KEY`

Notes:
- You can run all examples **without real credentials** using the built-in **mock provider**.
- For SMTP testing without real mailboxes, use [Ethereal](https://ethereal.email) credentials.

---

## Build / typecheck / tests

```bash
npm run typecheck
npm test
npm run build
```

### Coverage (PRD requirement)

```bash
npm run test:coverage
```

---

## Quick start (recommended)

Create an SDK instance with the fluent builder:

```ts
import { SDKBuilder } from "./src/core/SDKBuilder";

const sdk = new SDKBuilder()
  .addMockProvider("primary", { failureRate: 0.05 }, "primary")
  .withQueue({ concurrency: 5, pollIntervalMs: 50, maxSize: 10_000 })
  .withRetry({ maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30_000, jitter: true })
  .withCircuitBreaker({ failureThreshold: 5, recoveryTimeMs: 60_000 })
  .withRateLimit({ tokensPerSecond: 100, burstCapacity: 200, mode: "wait" })
  .withLogging({ destinations: ["console"] })
  .build();
```

---

## Sending email

### Fire-and-forget (enqueue)

```ts
await sdk.send({
  from: { email: "no-reply@example.com" },
  to: [{ email: "user@example.com" }],
  subject: "Hello",
  html: "<h1>Hello</h1>",
});
```

### Awaitable send (recommended for demos/tests)

This waits until the background worker finishes the job and returns the final `SendResult`.

```ts
const result = await sdk.send(
  {
    from: { email: "no-reply@example.com" },
    to: [{ email: "user@example.com" }],
    subject: "Hello",
    html: "<h1>Hello</h1>",
  },
  { awaitResult: true }
);

console.log(result.provider, result.status, result.latencyMs);
```

---

## Bulk send (bounded concurrency)

`sendBulk()` runs with bounded concurrency (based on configured queue concurrency) and returns results in input order.

```ts
const payloads = Array.from({ length: 50 }).map((_, i) => ({
  from: { email: "no-reply@example.com" },
  to: [{ email: `user${i}@example.com` }],
  subject: `Message #${i + 1}`,
  text: "Bulk email",
}));

const results = await sdk.sendBulk(payloads);
console.log(results.length);
```

---

## Templates

### Register and render by id

```ts
sdk.registerTemplate("welcome", "<h1>Welcome {{name}}</h1>");

await sdk.send(
  {
    from: { email: "no-reply@example.com" },
    to: [{ email: "user@example.com" }],
    subject: "Welcome",
    templateId: "welcome",
    templateData: { name: "Piyush" },
  },
  { awaitResult: true }
);
```

### Typed template registration (compile-time safety)

```ts
sdk.registerTemplateTyped<{ name: string }>("welcome2", "<h1>Hello {{name}}</h1>");
```

---

## Attachments

Attachments are supported in `EmailPayload.attachments`:

```ts
await sdk.send(
  {
    from: { email: "no-reply@example.com" },
    to: [{ email: "user@example.com" }],
    subject: "Invoice",
    text: "Attached",
    attachments: [
      {
        filename: "invoice.txt",
        content: "invoice data",
        contentType: "text/plain",
        encoding: "utf-8",
      },
    ],
  },
  { awaitResult: true }
);
```

Provider notes:
- **SMTP**: mapped to nodemailer attachments
- **SendGrid**: attachments encoded as base64
- **SES**: uses raw MIME (`SendRawEmailCommand`) when attachments exist

---

## Reliability behavior (what happens under failures)

This SDK implements the PRD system design behaviors:

- **Queue-based processing**: calls enqueue jobs; workers process in the background.
- **Retry + exponential backoff**: retryable failures are re-enqueued with `nextRetryAt`.
- **Max attempts**: once `retry.maxAttempts` is exceeded, the job becomes terminally failed and is moved to DLQ.
- **Fallback**: on provider failure, the SDK immediately tries the next provider in the chain (when configured).
- **Circuit breaker**: per provider; blocks when OPEN and allows a single probe in HALF_OPEN.
- **Rate limiting**: per provider token bucket; either waits or throws (depending on config).

---

## Events (observability)

Subscribe to lifecycle events:

```ts
sdk.on("email.queued", (e) => console.log("queued", e));
sdk.on("email.sent", (e) => console.log("sent", e));
sdk.on("email.failed", (e) => console.log("failed", e));
sdk.on("email.retrying", (e) => console.log("retrying", e));
```

Events are also logged as structured JSON when logging is enabled.

---

## Metrics and health

### Metrics snapshot

```ts
console.log(sdk.getStats());
```

Includes:
- total queued / sent / failed
- per-provider sent/failed counts and avg latency

### Provider health check

```ts
const health = await sdk.healthCheck();
console.log(health);
```

---

## Examples (runnable)

```bash
npm run example:basic
npm run example:fallback
npm run example:bulk
```

### Manual “user perspective” test runner

```bash
npx tsx examples/manual-test.ts
```

This script exercises:
- send (awaitable)
- templates
- attachments
- fallback
- queue-full backpressure
- metrics + healthCheck

---

## Shutdown (important)

Always shut down the SDK to stop workers cleanly:

```ts
await sdk.shutdown();
```

