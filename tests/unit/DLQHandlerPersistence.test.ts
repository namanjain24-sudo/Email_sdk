import { describe, expect, it, afterEach } from "vitest";
import { existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { DLQHandler } from "../../src/queue/DLQHandler";
import { EmailStatus } from "../../src/types/EmailStatus";
import type { QueueJob } from "../../src/queue/EmailQueue";

const TMP_PATH = join(tmpdir(), `dlq-test-${Date.now()}.json`);

afterEach(() => {
  if (existsSync(TMP_PATH)) rmSync(TMP_PATH);
});

function makeJob(id: string): QueueJob {
  return {
    id,
    correlationId: `corr-${id}`,
    payload: {
      id,
      from: { email: "a@a.com" },
      to: [{ email: "b@b.com" }],
      subject: "dlq test"
    },
    attempts: 3,
    enqueuedAt: new Date("2024-01-01T00:00:00Z"),
    nextRetryAt: Date.now(),
    status: EmailStatus.FAILED
  };
}

describe("DLQHandler – in-memory API", () => {
  it("starts empty", () => {
    const dlq = new DLQHandler();
    expect(dlq.list()).toHaveLength(0);
    expect(dlq.size).toBe(0);
  });

  it("add() appends a job and list() returns a copy", () => {
    const dlq = new DLQHandler();
    dlq.add(makeJob("j1"));
    dlq.add(makeJob("j2"));
    const listed = dlq.list();
    expect(listed).toHaveLength(2);
    expect(listed[0]!.id).toBe("j1");
    // list() returns a shallow copy: mutating it must not affect internal state
    listed.pop();
    expect(dlq.size).toBe(2);
  });

  it("remove() deletes the job by id and returns true", () => {
    const dlq = new DLQHandler();
    dlq.add(makeJob("j1"));
    dlq.add(makeJob("j2"));
    const removed = dlq.remove("j1");
    expect(removed).toBe(true);
    expect(dlq.size).toBe(1);
    expect(dlq.list()[0]!.id).toBe("j2");
  });

  it("remove() returns false when id is not found", () => {
    const dlq = new DLQHandler();
    dlq.add(makeJob("j1"));
    expect(dlq.remove("nonexistent")).toBe(false);
    expect(dlq.size).toBe(1);
  });

  it("clear() empties the queue", () => {
    const dlq = new DLQHandler();
    dlq.add(makeJob("j1"));
    dlq.add(makeJob("j2"));
    dlq.clear();
    expect(dlq.size).toBe(0);
    expect(dlq.list()).toHaveLength(0);
  });
});

describe("DLQHandler – disk persistence", () => {
  it("persists a job to disk after add()", () => {
    const dlq = new DLQHandler({ persistPath: TMP_PATH });
    dlq.add(makeJob("p1"));
    expect(existsSync(TMP_PATH)).toBe(true);
  });

  it("reloads persisted jobs on construction", () => {
    // First instance writes the job
    const dlq1 = new DLQHandler({ persistPath: TMP_PATH });
    dlq1.add(makeJob("p1"));
    dlq1.add(makeJob("p2"));

    // Second instance should load from disk
    const dlq2 = new DLQHandler({ persistPath: TMP_PATH });
    expect(dlq2.size).toBe(2);
    const ids = dlq2.list().map((j) => j.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p2");
  });

  it("updates the file when remove() is called", () => {
    const dlq = new DLQHandler({ persistPath: TMP_PATH });
    dlq.add(makeJob("p1"));
    dlq.add(makeJob("p2"));
    dlq.remove("p1");

    // New instance should only see p2
    const dlq2 = new DLQHandler({ persistPath: TMP_PATH });
    expect(dlq2.size).toBe(1);
    expect(dlq2.list()[0]!.id).toBe("p2");
  });

  it("clears the file when clear() is called", () => {
    const dlq = new DLQHandler({ persistPath: TMP_PATH });
    dlq.add(makeJob("p1"));
    dlq.clear();

    const dlq2 = new DLQHandler({ persistPath: TMP_PATH });
    expect(dlq2.size).toBe(0);
  });

  it("restores enqueuedAt as a Date object after reload", () => {
    const dlq1 = new DLQHandler({ persistPath: TMP_PATH });
    dlq1.add(makeJob("p1"));

    const dlq2 = new DLQHandler({ persistPath: TMP_PATH });
    const job = dlq2.list()[0]!;
    expect(job.enqueuedAt).toBeInstanceOf(Date);
  });

  it("handles corrupt persist file gracefully (starts fresh)", () => {
    // Write corrupt JSON
    const { writeFileSync } = require("fs") as typeof import("fs");
    writeFileSync(TMP_PATH, "NOT_JSON", "utf-8");

    const dlq = new DLQHandler({ persistPath: TMP_PATH });
    expect(dlq.size).toBe(0);
  });
});
