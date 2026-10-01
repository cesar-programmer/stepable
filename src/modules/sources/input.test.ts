import { describe, expect, it } from "vitest";

import { markdownMaxBytes } from "./contract.ts";
import { sourceIdentifiersSchema, validateSourceUpload } from "./input.ts";

describe("source upload validation", () => {
  it("accepts Markdown within the size limit and derives a title", () => {
    expect(
      validateSourceUpload({ fileName: "guia-apis.MD", byteSize: 10 }),
    ).toEqual({
      ok: true,
      title: "guia-apis",
      format: "markdown",
      contentType: "text/markdown",
    });
    expect(
      validateSourceUpload({
        fileName: "notas.markdown",
        byteSize: markdownMaxBytes,
        title: "  Convenciones\u0007 de   íconos ",
      }),
    ).toMatchObject({ ok: true, title: "Convenciones de íconos" });
  });

  it("rejects unsupported formats, empty files, oversized files and long titles", () => {
    expect(validateSourceUpload({ fileName: "a.pdf", byteSize: 1 })).toEqual({
      ok: false,
      code: "formato_no_admitido",
    });
    expect(validateSourceUpload({ fileName: "a.md", byteSize: 0 })).toEqual({
      ok: false,
      code: "archivo_vacio",
    });
    expect(
      validateSourceUpload({
        fileName: "a.md",
        byteSize: markdownMaxBytes + 1,
      }),
    ).toEqual({ ok: false, code: "archivo_demasiado_grande" });
    expect(
      validateSourceUpload({
        fileName: "a.md",
        byteSize: 1,
        title: "x".repeat(121),
      }),
    ).toEqual({ ok: false, code: "titulo_invalido" });
  });

  it("accepts only UUID identifiers", () => {
    expect(
      sourceIdentifiersSchema.safeParse({ spaceId: "x", sourceId: "y" })
        .success,
    ).toBe(false);
  });
});
