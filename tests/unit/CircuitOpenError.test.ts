import { describe, expect, it } from "vitest";
import { CircuitOpenError } from "../../src/errors/CircuitOpenError";
import { SDKError } from "../../src/errors/SDKError";

describe("CircuitOpenError", () => {
  it("is an instance of SDKError and Error", () => {
    const err = new CircuitOpenError("corr-1", "my-provider");
    expect(err).toBeInstanceOf(CircuitOpenError);
    expect(err).toBeInstanceOf(SDKError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets the error code to CIRCUIT_OPEN", () => {
    const err = new CircuitOpenError("corr-2", "sendgrid");
    expect(err.code).toBe("CIRCUIT_OPEN");
  });

  it("sets the name to CircuitOpenError", () => {
    const err = new CircuitOpenError("corr-3", "ses");
    expect(err.name).toBe("CircuitOpenError");
  });

  it("includes the provider name in the message", () => {
    const err = new CircuitOpenError("corr-4", "smtp");
    expect(err.message).toContain("smtp");
  });

  it("exposes the correlationId passed to the constructor", () => {
    const err = new CircuitOpenError("my-corr-id", "mock");
    expect(err.correlationId).toBe("my-corr-id");
  });

  it("exposes the providerName passed to the constructor", () => {
    const err = new CircuitOpenError("c", "special-provider");
    expect(err.providerName).toBe("special-provider");
  });

  it("sets a timestamp close to now", () => {
    const before = Date.now();
    const err = new CircuitOpenError("c", "p");
    const after = Date.now();
    expect(err.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(err.timestamp.getTime()).toBeLessThanOrEqual(after);
  });
});
