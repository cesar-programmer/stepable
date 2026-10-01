import {
  type ExtractionResult,
  type PdfTextExtractor,
  type ProcessingErrorCode,
  type SourceFileStorage,
  type SourceRepository,
  TransientProcessingError,
} from "./contract.ts";
import { extractMarkdown } from "./markdown.ts";
import { pdfPagesToSections } from "./pdf.ts";

export type ProcessingOutcome = "lista" | "fallida" | "omitida";

type ProcessingDependencies = {
  sourceRepository: SourceRepository;
  storage: SourceFileStorage;
  pdfExtractor: PdfTextExtractor;
};

type Extraction =
  | ExtractionResult
  | { ok: "transient"; code: "tiempo_agotado" | "error_interno" };

async function extract(
  dependencies: ProcessingDependencies,
  format: "markdown" | "pdf",
  bytes: Uint8Array,
): Promise<Extraction> {
  if (format === "markdown") return extractMarkdown(bytes);

  const result = await dependencies.pdfExtractor.extract(bytes);
  if (result.kind === "transient") {
    return { ok: "transient", code: result.code };
  }
  if (result.kind === "rejected") return { ok: false, code: result.code };
  return pdfPagesToSections(result.pageCount, result.pages);
}

async function transientFailure(
  dependencies: ProcessingDependencies,
  versionId: string,
  code: ProcessingErrorCode,
  finalAttempt: boolean,
  cause: unknown,
): Promise<ProcessingOutcome> {
  if (!finalAttempt) {
    throw new TransientProcessingError(code, { cause });
  }
  return (await dependencies.sourceRepository.failProcessing(versionId, code))
    ? "fallida"
    : "omitida";
}

/**
 * Processes one queued version. Permanent content errors mark the version as
 * failed; transient errors are rethrown so the queue can retry them, except on
 * the final attempt, where the version is marked failed with the same code.
 */
export async function processSourceVersion(
  dependencies: ProcessingDependencies,
  input: { versionId: string; finalAttempt: boolean },
): Promise<ProcessingOutcome> {
  const version = await dependencies.sourceRepository.startProcessing(
    input.versionId,
  );
  if (!version) return "omitida";

  let bytes: Uint8Array;
  try {
    bytes = await dependencies.storage.download(version.storageKey);
  } catch (error) {
    return transientFailure(
      dependencies,
      input.versionId,
      "almacenamiento_no_disponible",
      input.finalAttempt,
      error,
    );
  }

  const extraction = await extract(dependencies, version.format, bytes);
  if (extraction.ok === "transient") {
    return transientFailure(
      dependencies,
      input.versionId,
      extraction.code,
      input.finalAttempt,
      null,
    );
  }
  if (!extraction.ok) {
    return (await dependencies.sourceRepository.failProcessing(
      input.versionId,
      extraction.code,
    ))
      ? "fallida"
      : "omitida";
  }

  try {
    return (await dependencies.sourceRepository.completeProcessing(
      input.versionId,
      extraction.sections,
      extraction.pageCount,
    ))
      ? "lista"
      : "omitida";
  } catch (error) {
    return transientFailure(
      dependencies,
      input.versionId,
      "error_interno",
      input.finalAttempt,
      error,
    );
  }
}
