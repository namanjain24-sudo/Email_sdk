import { SDKBuilder } from "../src/core/SDKBuilder";

async function main(): Promise<void> {
  const sdk = new SDKBuilder()
    .addProvider("mock", { failureRate: 0.1 }, "primary-mock")
    .withLogging({ destinations: ["console"] })
    .build();

  const result = await sdk.send(
    {
      from: { email: "no-reply@example.com" },
      to: [{ email: "user@example.com" }],
      subject: "Welcome",
      html: "<h1>Hello</h1>"
    },
    { awaitResult: true }
  );

  console.log("Send result:", result);
  await sdk.shutdown();
}

void main();
