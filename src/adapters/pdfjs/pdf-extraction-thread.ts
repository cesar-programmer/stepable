import { parentPort } from "node:worker_threads";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type {
  PdfExtractionResult,
  PdfPageText,
} from "../../modules/sources/contract.ts";

type ExtractionRequest = { bytes: Uint8Array; maxPages: number };

async function extractPages(
  request: ExtractionRequest,
): Promise<PdfExtractionResult> {
  // pdf.js 6 no longer compiles code from PDF data (no eval/new Function),
  // which removed the CVE-2024-4367 path and the old isEvalSupported option.
  const loadingTask = getDocument({
    data: request.bytes,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });

  try {
    const document = await loadingTask.promise;
    // Any encryption dictionary (owner password included) is rejected.
    if ((await document.getPermissions()) !== null) {
      return { kind: "rejected", code: "pdf_protegido" };
    }
    if (document.numPages > request.maxPages) {
      return { kind: "rejected", code: "demasiadas_paginas" };
    }

    const pages: PdfPageText[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : "") : "",
        )
        .join("");
      pages.push({ pageNumber, text });
      page.cleanup();
    }
    return { kind: "pages", pageCount: document.numPages, pages };
  } catch (error) {
    return {
      kind: "rejected",
      code:
        error instanceof Error && error.name === "PasswordException"
          ? "pdf_protegido"
          : "pdf_danado",
    };
  } finally {
    await loadingTask.destroy();
  }
}

parentPort?.once("message", (request: ExtractionRequest) => {
  void extractPages(request).then((result) => parentPort?.postMessage(result));
});
