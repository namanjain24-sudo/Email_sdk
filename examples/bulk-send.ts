import { SDKBuilder } from "../src/core/SDKBuilder";

async function main(): Promise<void> {
  const sdk = new SDKBuilder().addProvider("mock", { failureRate: 0.05 }, "bulk-mock").build();

  const payloads = Array.from({ length: 20 }).map((_, index) => ({
    from: { email: "bulk@example.com" },
    to: [{ email: `user${index}@example.com` }],
    subject: `Bulk #${index + 1}`
  }));
  const results = await sdk.sendBulk(payloads);
  console.log("Sent:", results.length);
  console.log("Stats:", sdk.getStats());
  await sdk.shutdown();
}

void main();
