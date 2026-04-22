import { describe, expect, it } from "vitest";
import { AwsSesProvider } from "../../src/providers/AwsSesProvider";
import { createTestPayload } from "../utils/createTestPayload";

describe("AwsSesProvider raw MIME", () => {
  it("builds multipart/mixed with attachment", () => {
    const payload = createTestPayload({
      text: "Hello",
      attachments: [
        {
          filename: "hello.txt",
          content: "hi",
          contentType: "text/plain",
          encoding: "utf-8"
        }
      ]
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (AwsSesProvider as any).buildRawMime(payload) as Uint8Array;
    const s = Buffer.from(raw).toString("utf-8");
    expect(s).toContain("Content-Type: multipart/mixed");
    expect(s).toContain("Content-Disposition: attachment");
    expect(s).toContain("hello.txt");
  });
});

