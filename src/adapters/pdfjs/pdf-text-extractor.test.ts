import { describe, expect, it } from "vitest";

import { syntheticPdf } from "../../../tests/support/synthetic-pdf.ts";

import { WorkerThreadPdfExtractor } from "./pdf-text-extractor.ts";

const extractor = new WorkerThreadPdfExtractor();

describe("pdf.js text extraction in a worker thread", () => {
  it("extracts text per page and reports pages without text", async () => {
    await expect(
      extractor.extract(
        syntheticPdf(["Guía de íconos\nUsar (siempre) el set", null, "Fin"]),
      ),
    ).resolves.toEqual({
      kind: "pages",
      pageCount: 3,
      pages: [
        { pageNumber: 1, text: "Guía de íconos\nUsar (siempre) el set" },
        { pageNumber: 2, text: "" },
        { pageNumber: 3, text: "Fin" },
      ],
    });
  });

  it("rejects encrypted, damaged and over-long PDFs", async () => {
    await expect(
      extractor.extract(syntheticPdf([null], { userPassword: "secreto" })),
    ).resolves.toEqual({ kind: "rejected", code: "pdf_protegido" });
    await expect(
      extractor.extract(
        syntheticPdf([null], { userPassword: "", ownerPassword: "dueno" }),
      ),
    ).resolves.toEqual({ kind: "rejected", code: "pdf_protegido" });
    await expect(
      extractor.extract(Buffer.from("%PDF-1.7\nno es un PDF\n")),
    ).resolves.toEqual({ kind: "rejected", code: "pdf_danado" });
    await expect(
      extractor.extract(syntheticPdf(Array.from({ length: 201 }, () => null))),
    ).resolves.toEqual({ kind: "rejected", code: "demasiadas_paginas" });
  });

  it("stops the thread when the time limit is exceeded", async () => {
    await expect(
      new WorkerThreadPdfExtractor({ timeoutMs: 1 }).extract(
        syntheticPdf(["Hola"]),
      ),
    ).resolves.toEqual({ kind: "transient", code: "tiempo_agotado" });
  });
});
