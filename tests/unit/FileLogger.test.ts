import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { EmailEventEmitter } from "../../src/events/EmailEventEmitter";
import { FileLogger } from "../../src/events/FileLogger";

describe("FileLogger", () => {
  it("writes JSON lines for events", () => {
    const dir = mkdtempSync(join(tmpdir(), "email-sdk-"));
    const filePath = join(dir, "logs", "sdk.log");
    const emitter = new EmailEventEmitter();
    new FileLogger(filePath).attach(emitter);

    emitter.emit("email.sent", {
      messageId: "m1",
      correlationId: "c1",
      provider: "p1",
      status: "sent",
      latencyMs: 5,
      timestamp: new Date().toISOString()
    });

    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("\"event\":\"email.sent\"");
    expect(content).toContain("\"messageId\":\"m1\"");

    rmSync(dir, { recursive: true, force: true });
  });
});

