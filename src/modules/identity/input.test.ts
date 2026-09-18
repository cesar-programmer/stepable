import { describe, expect, it } from "vitest";

import { emailSchema, passwordUpdateSchema, safeInternalPath } from "./input";

describe("identity input", () => {
  it("normalizes an email address", () => {
    expect(emailSchema.parse("  PERSON@EXAMPLE.TEST ")).toBe(
      "person@example.test",
    );
  });

  it("requires matching passwords of at least eight characters", () => {
    expect(
      passwordUpdateSchema.safeParse({
        password: "short",
        confirmation: "short",
      }).success,
    ).toBe(false);
    expect(
      passwordUpdateSchema.safeParse({
        password: "local-password",
        confirmation: "different-password",
      }).success,
    ).toBe(false);
  });

  it("accepts only internal redirect paths", () => {
    expect(safeInternalPath("/protected")).toBe("/protected");
    expect(safeInternalPath("https://example.test")).toBe("/protected");
    expect(safeInternalPath("//example.test")).toBe("/protected");
  });
});
