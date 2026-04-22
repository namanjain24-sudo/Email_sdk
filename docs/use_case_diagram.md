# Email SDK – Use Case Diagram & Detailed Explanation

## Use Case Diagram (Mermaid)
```mermaid
usecaseDiagram
    actor "Client Application" as Client
    actor "Developer (Configuring SDK)" as Dev
    actor "Email Provider" as Provider
    
    rectangle EmailSDK {
        (Send Email) as SendEmail
        (Send Bulk Email) as SendBulk
        (Register Template) as RegisterTemplate
        (Get Statistics) as GetStats
        (Health Check) as HealthCheck
        (Subscribe to Events) as SubscribeEvents
        (Enqueue Email) as Enqueue
        (Process Queue) as ProcessQueue
        (Retry Failed Email) as RetryFailed
    }
    
    rectangle DeliveryEngine {
        (Deliver via Provider) as Deliver
    }
    
    rectangle TemplateEngine {
        (Render Template) as RenderTemplate
    }
    
    rectangle MetricsCollector {
        (Collect Metrics) as CollectMetrics
    }
    
    rectangle HealthChecker {
        (Check Provider Health) as CheckHealth
    }
    
    Client --> SendEmail
    Client --> SendBulk
    Client --> RegisterTemplate
    Client --> GetStats
    Client --> HealthCheck
    Client --> SubscribeEvents
    
    Dev --> RegisterTemplate
    Dev --> HealthCheck
    Dev --> SubscribeEvents
    
    SendEmail --> Enqueue
    SendBulk --> Enqueue
    Enqueue --> ProcessQueue
    ProcessQueue --> Deliver
    Deliver --> Provider
    
    RegisterTemplate --> RenderTemplate
    RenderTemplate --> TemplateEngine
    
    ProcessQueue --> RetryFailed
    RetryFailed --> Enqueue
    
    ProcessQueue --> CollectMetrics
    CollectMetrics --> MetricsCollector
    
    HealthCheck --> CheckHealth
    CheckHealth --> HealthChecker
```

---
## Detailed Explanation of the Use Cases

| Actor | Use Case | Description |
|-------|----------|-------------|
| **Client Application** | **Send Email** | The client creates an `EmailPayload` and calls `EmailSDK.send()`. The SDK normalises the payload, optionally renders a template, and enqueues the email for delivery. |
| **Client Application** | **Send Bulk Email** | Similar to *Send Email* but operates on an array of `EmailPayload`s, delegating each to the same queue workflow. |
| **Client Application** | **Register Template** | Allows the client to pre‑compile a template (e.g., Handlebars, MJML) and store it in the `TemplateCache` for later rendering. |
| **Client Application** | **Get Statistics** | Retrieves aggregated metrics (`SDKStats`) such as total sent, failures, average latency, etc., from the `MetricsCollector`. |
| **Client Application** | **Health Check** | Queries the `HealthChecker` to obtain the health status of each configured email provider (`ProviderHealth`). |
| **Client Application** | **Subscribe to Events** | Registers callbacks for SDK‑emitted events (`queued`, `sent`, `failed`, etc.) via `EmailSDK.on()`. |
| **Developer** | **Register Template** | Same as the client use case, but emphasises the developer’s role in configuring the SDK during initial setup. |
| **Developer** | **Health Check** | Allows developers to monitor provider health during development or CI pipelines. |
| **Developer** | **Subscribe to Events** | Enables developers to hook custom logging, monitoring, or audit trails into the SDK lifecycle. |
| **EmailSDK** (internal) | **Enqueue Email** | Places a normalized `EmailPayload` onto the `EmailQueue`. |
| **EmailSDK** (internal) | **Process Queue** | The `QueueWorker` continuously dequeues items and forwards them to the `DeliveryEngine`. |
| **DeliveryEngine** | **Deliver via Provider** | Selects an appropriate provider (SMTP, SendGrid, etc.) and attempts to send the email. |
| **Email Provider** | *External System* | Represents any third‑party email service that actually delivers the message. |
| **TemplateEngine** | **Render Template** | When a payload includes a `templateId`, the engine renders the stored template with supplied data to produce the final HTML body. |
| **MetricsCollector** | **Collect Metrics** | After each send attempt, the collector updates counters, latency measurements, and error tallies, which are exposed via `SDKStats`. |
| **HealthChecker** | **Check Provider Health** | Periodically pings each configured provider and returns a health snapshot (`ProviderHealth`). |
| **EmailSDK** (internal) | **Retry Failed Email** | If a delivery attempt fails and the retry policy permits, the SDK re‑queues the message for another attempt. |

---
## Interaction Flow (High‑Level)
1. **Client** invokes **Send Email** → **Enqueue Email**.
2. **QueueWorker** picks the message → **Process Queue**.
3. **DeliveryEngine** calls **Deliver via Provider** → external **Email Provider**.
4. On success/failure, **MetricsCollector** records the outcome (**Collect Metrics**).
5. If failure and retries remain, **Retry Failed Email** pushes the message back onto the queue.
6. Throughout the flow, the SDK emits events that the **Client** can listen to via **Subscribe to Events**.
7. **Health Check** and **Get Statistics** are read‑only queries that pull data from **HealthChecker** and **MetricsCollector**, respectively.

---
## Why This Diagram is Useful
- **Clear Actor Boundaries** – Differentiates external consumers (client, developer) from internal components.
- **Coverage of All Core Operations** – Every public method of `EmailSDK` maps to a use case, ensuring no hidden functionality.
- **Extensibility Insight** – Adding a new provider or a custom analytics sink simply extends the relevant internal use case without affecting the external contract.
- **Documentation Consistency** – The diagram aligns with the ER diagram and architecture overview already provided, giving a complete visual spec of the SDK.

---
*Save this file as `docs/use_case_diagram.md` for easy reference and rendering in any markdown viewer.*
