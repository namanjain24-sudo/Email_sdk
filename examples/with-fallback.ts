import { SDKBuilder } from "../src/core/SDKBuilder";

async function main(): Promise<void> {
  const sdk = new SDKBuilder()
    .addProvider("mock", { failureRate: 1 }, "primary-down")
    .addProvider("mock", { failureRate: 0 }, "fallback-ok")
    .withRetry({ maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000, jitter: true })
    .withCircuitBreaker({ failureThreshold: 2, recoveryTimeMs: 1000 })
    .build();

  sdk.on("email.retrying", (e) => console.log("retrying", e));
  sdk.on("email.sent", (e) => console.log("sent", e));

  const res = await sdk.send(
    {
      from: { email: "no-reply@example.com" },
      to: [{ email: "user@example.com" }],
      subject: "Fallback demo"
    },
    { awaitResult: true }
  );
  console.log(res);
  await sdk.shutdown();
}

void main();
