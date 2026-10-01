import { describe, expect, it } from "vitest";

import { extractMarkdown } from "./markdown.ts";

const encode = (text: string) => new TextEncoder().encode(text);

describe("Markdown extraction", () => {
  it("splits sections by ATX headings and keeps the heading path", () => {
    const result = extractMarkdown(
      encode(
        [
          "Introducción breve.",
          "",
          "# Guía de APIs",
          "Usar contratos versionados.",
          "## Errores ##",
          "Responder con códigos estables.",
          "# Íconos",
          "Usar el set compartido.",
        ].join("\r\n"),
      ),
    );

    expect(result).toEqual({
      ok: true,
      sections: [
        {
          ordinal: 0,
          headingPath: [],
          startLine: 1,
          endLine: 1,
          content: "Introducción breve.",
        },
        {
          ordinal: 1,
          headingPath: ["Guía de APIs"],
          startLine: 3,
          endLine: 4,
          content: "# Guía de APIs\nUsar contratos versionados.",
        },
        {
          ordinal: 2,
          headingPath: ["Guía de APIs", "Errores"],
          startLine: 5,
          endLine: 6,
          content: "## Errores ##\nResponder con códigos estables.",
        },
        {
          ordinal: 3,
          headingPath: ["Íconos"],
          startLine: 7,
          endLine: 8,
          content: "# Íconos\nUsar el set compartido.",
        },
      ],
    });
  });

  it("ignores heading-like lines inside fenced code blocks", () => {
    const result = extractMarkdown(
      encode("# Ejemplo\n```bash\n# no es encabezado\n```\nFin"),
    );
    expect(result.ok && result.sections).toHaveLength(1);
    expect(result.ok && result.sections[0].content).toContain(
      "# no es encabezado",
    );
  });

  it("accepts short documents with useful content and a byte order mark", () => {
    expect(extractMarkdown(encode("﻿Hola"))).toEqual({
      ok: true,
      sections: [
        {
          ordinal: 0,
          headingPath: [],
          startLine: 1,
          endLine: 1,
          content: "Hola",
        },
      ],
    });
  });

  it("rejects empty, non UTF-8 and NUL-containing content", () => {
    expect(extractMarkdown(encode(" \n\t\n"))).toEqual({
      ok: false,
      code: "contenido_vacio",
    });
    expect(extractMarkdown(new Uint8Array([0xff, 0xfe, 0x41]))).toEqual({
      ok: false,
      code: "codificacion_invalida",
    });
    expect(extractMarkdown(encode("texto\u0000binario"))).toEqual({
      ok: false,
      code: "codificacion_invalida",
    });
  });
});
