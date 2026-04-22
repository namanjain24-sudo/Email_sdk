import { SDKBuilder } from "../src/core/SDKBuilder";
import { EmailPayload } from "../src/types/EmailPayload";

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  console.log("\n=== Manual test: basic + events + metrics ===");
  const sdk = new SDKBuilder()
    .addMockProvider("primary", { failureRate: 0.0, baseLatencyMs: 10 })
    .withQueue({ concurrency: 2, pollIntervalMs: 20, maxSize: 5 })
    .withRetry({ maxAttempts: 3, baseDelayMs: 50, maxDelayMs: 200, jitter: false })
    .withRateLimit({ tokensPerSecond: 2, burstCapacity: 2, mode: "wait" })
    .withLogging({ destinations: ["console"] })
    .build();

  sdk.on("email.queued", (e) => console.log("EVENT queued:", e));
  sdk.on("email.sent", (e) => console.log("EVENT sent:", e));
  sdk.on("email.failed", (e) => console.log("EVENT failed:", e));
  sdk.on("email.retrying", (e) => console.log("EVENT retrying:", e));

  sdk.registerTemplate("welcome", "<h1>Welcome {{name}}</h1>");

  const payload: EmailPayload = {
    from: { email: "no-reply@example.com" },
    to: [{ email: "user@example.com" }],
    subject: "Welcome",
    templateId: "welcome",
    templateData: { name: "Piyush" },
    text: "Welcome Piyush",
    attachments: [
      {
        filename: "hello.txt",
        content: "hello",
        contentType: "text/plain",
        encoding: "utf-8"
      }
    ],
    priority: "high"
  };

  const res = await sdk.send(payload, { awaitResult: true });
  console.log("RESULT:", res);
  console.log("STATS:", sdk.getStats());

  console.log("\n=== Manual test: fallback + retry ===");
  const sdk2 = new SDKBuilder()
    .addMockProvider("down-primary", { failureRate: 1, baseLatencyMs: 5 })
    .addMockProvider("ok-fallback", { failureRate: 0, baseLatencyMs: 5 })
    .withQueue({ concurrency: 1, pollIntervalMs: 10 })
    .withRetry({ maxAttempts: 3, baseDelayMs: 25, maxDelayMs: 100, jitter: false })
    .withLogging({ destinations: ["console"] })
    .build();

  const res2 = await sdk2.send(
    {
      from: { email: "no-reply@example.com" },
      to: [{ email: "user@example.com" }],
      subject: "Fallback demo"
    },
    { awaitResult: true }
  );
  console.log("RESULT:", res2);
  await sdk2.shutdown();

  console.log("\n=== Manual test: queue full backpressure ===");
  const sdk3 = new SDKBuilder()
    .addMockProvider("p1", { failureRate: 0, baseLatencyMs: 200 })
    .withQueue({ concurrency: 1, pollIntervalMs: 50, maxSize: 2 })
    .withLogging({ destinations: ["console"] })
    .build();

  try {
    // Fill the queue quickly with fire-and-forget; maxSize=2 should reject the third enqueue.
    await sdk3.send({ from: { email: "a@a.com" }, to: [{ email: "b@b.com" }], subject: "1" });
    await sdk3.send({ from: { email: "a@a.com" }, to: [{ email: "b@b.com" }], subject: "2" });
    await sdk3.send({ from: { email: "a@a.com" }, to: [{ email: "b@b.com" }], subject: "3" });
    console.log("Unexpected: queue did not reject");
  } catch (e) {
    console.log("EXPECTED queue full error:", e);
  } finally {
    await sdk3.shutdown();
  }

  console.log("\n=== Manual test: healthCheck snapshot ===");
  const health = await sdk.healthCheck();
  console.log("HEALTH:", health);

  await sleep(50);
  await sdk.shutdown();
}

void main();

