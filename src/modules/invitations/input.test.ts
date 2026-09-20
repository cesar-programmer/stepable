import { describe, expect, it } from "vitest";

import { createInvitationInputSchema, invitationTokenSchema } from "./input";

const spaceId = "9f34f3ea-6287-46d2-b4b7-59d3a5df49ea";

describe("invitation input", () => {
  it("normalizes email and defaults to member", () => {
    expect(
      createInvitationInputSchema.parse({
        spaceId,
        email: "  PERSON@EXAMPLE.TEST ",
      }),
    ).toEqual({
      spaceId,
      email: "person@example.test",
      role: "integrante",
    });
  });

  it("accepts responsible only as an explicit valid role", () => {
    expect(
      createInvitationInputSchema.parse({
        spaceId,
        email: "person@example.test",
        role: "responsable",
      }).role,
    ).toBe("responsable");
    expect(
      createInvitationInputSchema.safeParse({
        spaceId,
        email: "person@example.test",
        role: "administrador",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed invitation tokens", () => {
    expect(invitationTokenSchema.safeParse("too-short").success).toBe(false);
    expect(invitationTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(invitationTokenSchema.safeParse(`${"a".repeat(42)}!`).success).toBe(
      false,
    );
  });
});
