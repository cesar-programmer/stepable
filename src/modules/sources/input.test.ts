import { describe, expect, it } from "vitest";

import { markdownMaxBytes, pdfMaxBytes } from "./contract.ts";
import { sourceIdentifiersSchema, validateSourceUpload } from "./input.ts";

const text = new TextEncoder().encode("# Título");
const pdfHeader = new TextEncoder().encode("%PDF-1.7\n");

describe("source upload validation", () => {
  it("accepts Markdown within the size limit and derives a title", () => {
    expect(
      validateSourceUpload({
        fileName: "guia-apis.MD",
        byteSize: 10,
        leadingBytes: text,
      }),
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
        leadingBytes: text,
        title: "  Convenciones\u0007 de   íconos ",
      }),
    ).toMatchObject({ ok: true, title: "Convenciones de íconos" });
  });

  it("accepts PDF up to 8 MiB only with a PDF signature", () => {
    expect(
      validateSourceUpload({
        fileName: "manual.PDF",
        byteSize: pdfMaxBytes,
        leadingBytes: pdfHeader,
      }),
    ).toEqual({
      ok: true,
      title: "manual",
      format: "pdf",
      contentType: "application/pdf",
    });
    expect(
      validateSourceUpload({
        fileName: "falso.pdf",
        byteSize: 10,
        leadingBytes: text,
      }),
    ).toEqual({ ok: false, code: "formato_no_admitido" });
    expect(
      validateSourceUpload({
        fileName: "grande.pdf",
        byteSize: pdfMaxBytes + 1,
        leadingBytes: pdfHeader,
      }),
    ).toEqual({ ok: false, code: "archivo_demasiado_grande" });
  });

  it("rejects unsupported formats, empty files, oversized Markdown and long titles", () => {
    const base = { leadingBytes: text };
    expect(
      validateSourceUpload({ ...base, fileName: "a.txt", byteSize: 1 }),
    ).toEqual({ ok: false, code: "formato_no_admitido" });
    expect(
      validateSourceUpload({ ...base, fileName: "a.md", byteSize: 0 }),
    ).toEqual({ ok: false, code: "archivo_vacio" });
    expect(
      validateSourceUpload({
        ...base,
        fileName: "a.md",
        byteSize: markdownMaxBytes + 1,
      }),
    ).toEqual({ ok: false, code: "archivo_demasiado_grande" });
    expect(
      validateSourceUpload({
        ...base,
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
