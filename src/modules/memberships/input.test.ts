import { describe, expect, it } from "vitest";

import { leaveSpaceInputSchema, memberRoleChangeInputSchema } from "./input.ts";

describe("membership inputs", () => {
  const id = "f7dbdbb8-dd35-45ea-9511-44c66e47d54f";

  it("accepts closed roles and UUID identifiers", () => {
    expect(
      memberRoleChangeInputSchema.parse({
        spaceId: id,
        targetProfileId: id,
        role: "responsable",
      }),
    ).toEqual({ spaceId: id, targetProfileId: id, role: "responsable" });
    expect(leaveSpaceInputSchema.parse({ spaceId: id })).toEqual({
      spaceId: id,
    });
  });

  it("rejects unknown roles and malformed identifiers", () => {
    expect(
      memberRoleChangeInputSchema.safeParse({
        spaceId: id,
        targetProfileId: id,
        role: "administrador",
      }).success,
    ).toBe(false);
    expect(
      leaveSpaceInputSchema.safeParse({ spaceId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});
