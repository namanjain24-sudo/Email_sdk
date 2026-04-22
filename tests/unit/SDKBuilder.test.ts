import { describe, expect, it } from "vitest";
import { SDKBuilder } from "../../src/core/SDKBuilder";
import { ValidationError } from "../../src/errors/ValidationError";

describe("SDKBuilder", () => {
  it("throws ValidationError when no providers configured", () => {
    expect(() => new SDKBuilder().build()).toThrowError(ValidationError);
  });
});

