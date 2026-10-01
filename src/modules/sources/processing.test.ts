import { describe, expect, it } from "vitest";

import {
  type PdfExtractionResult,
  type ProcessingErrorCode,
  type SourceFileStorage,
  type SourceRepository,
  type SourceSection,
  TransientProcessingError,
} from "./contract.ts";
import { processSourceVersion } from "./processing.ts";

function fakes(
  options: {
    format?: "markdown" | "pdf";
    download?: () => Promise<Uint8Array>;
    pdf?: PdfExtractionResult;
  } = {},
) {
  const failures: ProcessingErrorCode[] = [];
  const completed: { sections: SourceSection[]; pageCount: number | null }[] =
    [];
  const repository = {
    startProcessing: async (versionId: string) => ({
      versionId,
      spaceId: "space",
      storageKey: "key",
      format: options.format ?? "markdown",
    }),
    completeProcessing: async (
      _versionId: string,
      sections: SourceSection[],
      pageCount: number | null,
    ) => {
      completed.push({ sections, pageCount });
      return true;
    },
    failProcessing: async (_versionId: string, code: ProcessingErrorCode) => {
      failures.push(code);
      return true;
    },
  } as unknown as SourceRepository;
  const storage = {
    download:
      options.download ?? (async () => new TextEncoder().encode("# A\ntexto")),
  } as unknown as SourceFileStorage;
  const pdfExtractor = {
    extract: async () =>
      options.pdf ?? ({ kind: "pages", pageCount: 0, pages: [] } as const),
  };
  return {
    dependencies: { sourceRepository: repository, storage, pdfExtractor },
    failures,
    completed,
  };
}

const run = (
  dependencies: ReturnType<typeof fakes>["dependencies"],
  finalAttempt = false,
) => processSourceVersion(dependencies, { versionId: "v", finalAttempt });

describe("source version processing", () => {
  it("marks a valid Markdown version as ready", async () => {
    const { dependencies, completed } = fakes();
    await expect(run(dependencies)).resolves.toBe("lista");
    expect(completed[0].sections).toHaveLength(1);
  });

  it("stores one section per PDF page with text and keeps the page count", async () => {
    const { dependencies, completed } = fakes({
      format: "pdf",
      pdf: {
        kind: "pages",
        pageCount: 3,
        pages: [
          { pageNumber: 1, text: "Hola" },
          { pageNumber: 2, text: "  \n " },
          { pageNumber: 3, text: "Página   tres\n\n\n\nfin" },
        ],
      },
    });
    await expect(run(dependencies)).resolves.toBe("lista");
    expect(completed[0].pageCount).toBe(3);
    expect(
      completed[0].sections.map(({ pageNumber, content }) => ({
        pageNumber,
        content,
      })),
    ).toEqual([
      { pageNumber: 1, content: "Hola" },
      { pageNumber: 3, content: "Página tres\n\nfin" },
    ]);
  });

  it("fails permanent content errors without asking for a retry", async () => {
    const empty = fakes({
      download: async () => new TextEncoder().encode("   "),
    });
    await expect(run(empty.dependencies)).resolves.toBe("fallida");
    expect(empty.failures).toEqual(["contenido_vacio"]);

    const scanned = fakes({
      format: "pdf",
      pdf: {
        kind: "pages",
        pageCount: 1,
        pages: [{ pageNumber: 1, text: "" }],
      },
    });
    await expect(run(scanned.dependencies)).resolves.toBe("fallida");
    expect(scanned.failures).toEqual(["sin_texto_extraible"]);

    const encrypted = fakes({
      format: "pdf",
      pdf: { kind: "rejected", code: "pdf_protegido" },
    });
    await expect(run(encrypted.dependencies)).resolves.toBe("fallida");
    expect(encrypted.failures).toEqual(["pdf_protegido"]);
  });

  it("retries transient errors and fails them only on the final attempt", async () => {
    const unavailable = async () => {
      throw new Error("offline");
    };
    const retry = fakes({ download: unavailable });
    await expect(run(retry.dependencies)).rejects.toBeInstanceOf(
      TransientProcessingError,
    );
    expect(retry.failures).toEqual([]);

    const final = fakes({ download: unavailable });
    await expect(run(final.dependencies, true)).resolves.toBe("fallida");
    expect(final.failures).toEqual(["almacenamiento_no_disponible"]);

    const slowPdf = fakes({
      format: "pdf",
      pdf: { kind: "transient", code: "tiempo_agotado" },
    });
    await expect(run(slowPdf.dependencies)).rejects.toMatchObject({
      code: "tiempo_agotado",
    });
  });
});
