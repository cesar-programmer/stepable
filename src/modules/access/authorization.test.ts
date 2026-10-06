import { describe, expect, it } from "vitest";

import { allowsSpaceAction } from "./authorization.ts";

describe("space authorization policy", () => {
  it.each([
    ["responsable", "consultar_espacio", true],
    ["responsable", "gestionar_invitaciones", true],
    ["responsable", "gestionar_miembros", true],
    ["responsable", "abandonar_espacio", true],
    ["integrante", "consultar_espacio", true],
    ["integrante", "gestionar_invitaciones", false],
    ["integrante", "gestionar_miembros", false],
    ["integrante", "abandonar_espacio", true],
    ["responsable", "consultar_fuentes", true],
    ["responsable", "gestionar_fuentes", true],
    ["integrante", "consultar_fuentes", true],
    ["integrante", "gestionar_fuentes", false],
    ["responsable", "consultar_rutas", true],
    ["responsable", "gestionar_rutas", true],
    ["integrante", "consultar_rutas", true],
    ["integrante", "gestionar_rutas", false],
    ["responsable", "consultar_progreso_equipo", true],
    ["integrante", "consultar_progreso_equipo", false],
    ["responsable", "consultar_consumo_ia", true],
    ["integrante", "consultar_consumo_ia", false],
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
