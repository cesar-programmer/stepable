import { describe, expect, it } from "vitest";

import { allowsSpaceAction } from "./authorization.ts";

describe("space authorization policy", () => {
  it.each([
    ["responsable", "consultar_espacio", true],
    ["responsable", "gestionar_invitaciones", true],
    ["responsable", "gestionar_miembros", true],
    ["integrante", "consultar_espacio", true],
    ["integrante", "gestionar_invitaciones", false],
    ["integrante", "gestionar_miembros", false],
  ] as const)("evaluates %s and %s as %s", (role, action, expected) => {
    expect(allowsSpaceAction("activa", role, action)).toBe(expected);
  });

  it("denies revoked memberships, unknown roles and unknown actions", () => {
    expect(
      allowsSpaceAction("revocada", "responsable", "consultar_espacio"),
    ).toBe(false);
    expect(
      allowsSpaceAction("activa", "administrador", "consultar_espacio"),
    ).toBe(false);
    expect(
      allowsSpaceAction("activa", "responsable", "accion_desconocida"),
    ).toBe(false);
  });
});
