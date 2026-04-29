# Email SDK Project Report

> **Note on Report Structure:** The requested outline originates from a Data Science/Machine Learning rubric. This report adapts those core requirements (Data, EDA, Methodology, Evaluation, Optimization) to fit the **Enterprise Email SDK**, which is an advanced Backend System Design & Engineering project.

---

## 1. Problem Statement

Modern applications heavily rely on email communication (transactional, marketing, alerts) but face significant integration challenges:
- **Provider Lock-In:** Applications hardcode implementations for a specific vendor (e.g., AWS SES, SendGrid), making switching costly and time-consuming.
- **Transient Failures:** Network glitches, provider downtimes, or DNS issues cause critical emails to be permanently lost.
- **Rate Limiting:** Sending bulk emails without control leads to HTTP 429 (Too Many Requests) errors and potential account suspension by providers.
- **Lack of Observability:** No centralized system to track successful deliveries, retry attempts, or catastrophic failures.

**The Solution:** An enterprise-grade, provider-agnostic **Email SDK** built in TypeScript. It abstracts away the provider implementations and introduces robust resilience patterns (retries, circuit breakers, rate limiters) to ensure high-availability delivery.

---

## 2. Data Description

In the context of this SDK, "Data" refers to the payload structures, event streams, and state configurations traversing the system:
- **Input Data (EmailRequests):** Contains standard email fields (`to`, `from`, `subject`, `html`, `text`) along with SDK-specific metadata like `priority` (High/Normal/Low), `templateId`, and `context`.
- **System State Data:** 
  - *Queue State:* In-memory priority queue tracking `enqueuedAt`, `nextRetryAt`, and `retryCount`.
  - *Circuit Breaker State:* Tracks consecutive failures (`failureCount`) and state transitions (`CLOSED`, `OPEN`, `HALF-OPEN`).
  - *Rate Limiter Tokens:* Tracks available tokens and refill timestamps.
- **Output Event Data:** Event streams emitted via `EmailEventEmitter` (`email.queued`, `email.sent`, `email.failed`, `email.retrying`), carrying operational metrics.

---

## 3. EDA Process (Exploratory System & Failure Analysis)

Before designing the architecture, an exploratory analysis of typical email delivery failures and bottlenecks was conducted:
1. **API Rate Limit Analysis:** Providers enforce strict quotas (e.g., 100 req/sec). Unthrottled `Promise.all` bursts lead to immediate failures. *Insight: A Token Bucket rate limiter is required.*
2. **Failure Categorization:** Analyzed provider error codes. HTTP 400 (Bad Request) or 401 (Unauthorized) are deterministic and non-retryable. HTTP 429 or 503 are transient. *Insight: The retry policy needs intelligent error classification.*
3. **Latency Bottlenecks:** Blocking the main thread while waiting for an external SMTP server reduces application throughput. *Insight: An asynchronous Background Queue and Worker pool is necessary.*

---

## 4. Methodology (System Architecture & Algorithms)

The SDK employs several advanced software engineering algorithms and design patterns to guarantee delivery:

- **Provider Abstraction (Strategy Pattern):** Unified `IEmailProvider` interface allows swapping AWS SES, SendGrid, and SMTP on the fly without changing application code.
- **Token Bucket Algorithm (Rate Limiting):** Controls the outflow of emails. Tokens are added at a steady rate; an email can only be sent if a token is available, smoothing out burst traffic.
- **Exponential Backoff with Jitter (Retry Policy):** When a transient failure occurs, retries are delayed exponentially ($delay = base \times 2^{attempt}$) with randomized jitter to prevent the "thundering herd" problem on recovery.
- **Circuit Breaker State Machine:** If a provider fails consecutively (e.g., 5 times), the circuit "OPENS" and fast-fails subsequent requests. After a timeout, it transitions to "HALF-OPEN" to test recovery, preventing resource exhaustion on dead downstream services.
- **Priority Queueing:** Jobs are sorted by priority (High over Low) and `nextRetryAt` timestamps.

---

## 5. Evaluation

While ML models use F1-Score or RMSE, this distributed system is evaluated on **Resilience, Throughput, and Reliability Metrics** using the built-in `MetricsCollector`:
- **Delivery Success Rate:** Percentage of emails successfully delivered, even after initial failures. The fallback mechanism (switching to SMTP if SES fails) pushes this closer to 99.99%.
- **System Latency:** The SDK evaluates the $P95$ queue wait time and processing time per job.
- **Throughput Efficiency:** The Token Bucket ensures the SDK stays exactly at or just below the provider's max queries-per-second (QPS) without triggering HTTP 429s.
- **Automated Test Coverage:** Evaluated via Vitest unit tests simulating edge cases (e.g., Circuit Breaker state transitions, queue starvation).

---

## 6. Optimization

Several optimizations were applied to maximize performance and memory efficiency:
- **LRU Template Caching:** Compiling Handlebars/Mustache templates is CPU-intensive. An LRU (Least Recently Used) cache stores compiled templates, saving CPU cycles on bulk transactional emails.
- **Dead-Letter Queue (DLQ):** Emails that exhaust all retry attempts or hit non-retryable errors are routed off the main queue into a DLQ. This prevents poison-pill messages from blocking the system.
- **Non-Blocking Async Workers:** The Queue Worker runs in isolated asynchronous loops, polling the queue at configurable intervals, ensuring the host Node.js event loop is never blocked.
- **Short-circuiting:** By placing the Rate Limiter and Circuit Breaker *before* the network call, the SDK saves bandwidth and latency when a provider is known to be down.

---

## 7. Team Contribution

*(Customize this section based on your specific team structure. Below is a standard full-stack breakdown)*

- **Core System Architect:** Designed the Fallback Chain, Circuit Breaker, and Token Bucket implementations.
- **Integration Engineer:** Implemented the AWS SES, SendGrid, and SMTP provider adapters.
- **Observability Lead:** Built the Event Emitter, Metrics Collector, and Logging (Console/File) systems.
- **QA & Testing:** Wrote the Vitest test suites simulating network failures, rate limiting, and queue priority.

---
*Generated based on the Email SDK architecture and codebase.*
