import {
  type ProcessingErrorCode,
  type SourceFileStorage,
  type SourceRepository,
  TransientProcessingError,
} from "./contract.ts";
import { extractMarkdown } from "./markdown.ts";

export type ProcessingOutcome = "lista" | "fallida" | "omitida";

type ProcessingDependencies = {
  sourceRepository: SourceRepository;
  storage: SourceFileStorage;
};

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

  const extraction =
    version.format === "markdown"
      ? extractMarkdown(bytes)
      : ({ ok: false, code: "error_interno" } as const);
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
