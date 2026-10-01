import {
  type SourceFileStorage,
  type SourceRepository,
  TransientProcessingError,
} from "./contract.ts";

/**
 * Removes the originals and extracted text of every version of a deleted
 * source. Storage failures are transient: the queue retries them and the
 * worker sweep re-enqueues purges that remain pending afterwards.
 */
export async function purgeDeletedSource(
  dependencies: {
    sourceRepository: SourceRepository;
    storage: SourceFileStorage;
  },
  input: { sourceId: string },
): Promise<"purgada" | "omitida"> {
  const target = await dependencies.sourceRepository.findPurgeTarget(
    input.sourceId,
  );
  if (!target) return "omitida";

  try {
    await dependencies.storage.removeMany(target.storageKeys);
  } catch (error) {
    throw new TransientProcessingError("almacenamiento_no_disponible", {
      cause: error,
    });
  }

  return (await dependencies.sourceRepository.completePurge(input.sourceId))
    ? "purgada"
    : "omitida";
}
