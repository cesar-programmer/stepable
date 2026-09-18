import { describe, expect, it } from "vitest";

import { bootstrapSpaceInputSchema, spaceIdSchema } from "./input";

describe("access input", () => {
  it("normalizes valid bootstrap parameters", () => {
    expect(
      bootstrapSpaceInputSchema.parse({
        email: "  PERSON@EXAMPLE.TEST ",
        slug: "  PLATFORM-TEAM ",
        name: "  Platform Team  ",
      }),
    ).toEqual({
      email: "person@example.test",
      slug: "platform-team",
      name: "Platform Team",
    });
  });

  it("rejects invalid space slugs", () => {
    expect(
      bootstrapSpaceInputSchema.safeParse({
        email: "person@example.test",
        slug: "Invalid slug",
        name: "Platform Team",
      }).success,
    ).toBe(false);
  });

  it("accepts only UUID space identifiers", () => {
    expect(spaceIdSchema.safeParse(crypto.randomUUID()).success).toBe(true);
    expect(spaceIdSchema.safeParse("not-a-space-id").success).toBe(false);
  });
});
