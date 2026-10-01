import { createHash, randomUUID } from "node:crypto";

import {
  allowsSpaceAction,
  authorizeSpaceAction,
} from "../access/authorization.ts";
import type { AccessRepository } from "../access/contract.ts";

import type {
  DeleteSourceResult,
  RetryVersionResult,
  SourceSection,
  SourceFileStorage,
  SourceListing,
  SourceRepository,
  SourceSummary,
  UploadRejectionCode,
} from "./contract.ts";
import { validateSourceUpload } from "./input.ts";

type ReadDependencies = {
  accessRepository: AccessRepository;
  sourceRepository: SourceRepository;
};

type UploadDependencies = ReadDependencies & {
  storage: SourceFileStorage;
};

export type UploadSourceResult =
  | { kind: "queued"; sourceId: string }
  | { kind: "unauthorized" }
  | { kind: "rejected"; code: UploadRejectionCode };

async function removeQuietly(storage: SourceFileStorage, key: string) {
  try {
    await storage.remove(key);
  } catch {
    // A leftover private object has no metadata row and is never served.
  }
}

export async function uploadSource(
  dependencies: UploadDependencies,
  input: {
    identityId: string;
    spaceId: string;
    fileName: string;
    bytes: Uint8Array;
    title?: string | null;
  },
): Promise<UploadSourceResult> {
  if (
    !(await authorizeSpaceAction(
      dependencies.accessRepository,
      input.identityId,
      input.spaceId,
      "gestionar_fuentes",
    ))
  ) {
    return { kind: "unauthorized" };
  }

  const validated = validateSourceUpload({
    fileName: input.fileName,
    byteSize: input.bytes.byteLength,
    leadingBytes: input.bytes.subarray(0, 1024),
    title: input.title,
  });
  if (!validated.ok) {
    return { kind: "rejected", code: validated.code };
  }

  const sourceId = randomUUID();
  const versionId = randomUUID();
  const storageKey = `${input.spaceId}/${sourceId}/${versionId}`;

  try {
    await dependencies.storage.upload(
      storageKey,
      input.bytes,
      validated.contentType,
    );
  } catch {
    return { kind: "rejected", code: "almacenamiento_no_disponible" };
  }

  try {
    const created =
      await dependencies.sourceRepository.createSourceWithFirstVersion({
        sourceId,
        versionId,
        spaceId: input.spaceId,
        title: validated.title,
        format: validated.format,
        byteSize: input.bytes.byteLength,
        sha256: createHash("sha256").update(input.bytes).digest("hex"),
        storageKey,
        createdBy: input.identityId,
      });
    if (created.kind === "created") {
      return { kind: "queued", sourceId };
    }
    await removeQuietly(dependencies.storage, storageKey);
    return created.kind === "unauthorized"
      ? { kind: "unauthorized" }
      : { kind: "rejected", code: created.kind };
  } catch (error) {
    await removeQuietly(dependencies.storage, storageKey);
    throw error;
  }
}

export type ReplaceSourceResult =
  | { kind: "queued"; versionNumber: number }
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "rejected"; code: UploadRejectionCode };

/**
 * Uploads a new candidate version for an existing source. The current version
 * stays available until the candidate is ready; a failed candidate is
 * superseded (kept as "descartada") by a newer upload.
 */
export async function replaceSourceFile(
  dependencies: UploadDependencies,
  input: {
    identityId: string;
    spaceId: string;
    sourceId: string;
    fileName: string;
    bytes: Uint8Array;
  },
): Promise<ReplaceSourceResult> {
  if (
    !(await authorizeSpaceAction(
      dependencies.accessRepository,
      input.identityId,
      input.spaceId,
      "gestionar_fuentes",
    ))
  ) {
    return { kind: "unauthorized" };
  }

  const validated = validateSourceUpload({
    fileName: input.fileName,
    byteSize: input.bytes.byteLength,
    leadingBytes: input.bytes.subarray(0, 1024),
  });
  if (!validated.ok) {
    return { kind: "rejected", code: validated.code };
  }

  const versionId = randomUUID();
  const storageKey = `${input.spaceId}/${input.sourceId}/${versionId}`;
  try {
    await dependencies.storage.upload(
      storageKey,
      input.bytes,
      validated.contentType,
    );
  } catch {
    return { kind: "rejected", code: "almacenamiento_no_disponible" };
  }

  try {
    const created =
      await dependencies.sourceRepository.createReplacementVersion({
        sourceId: input.sourceId,
        versionId,
        spaceId: input.spaceId,
        format: validated.format,
        byteSize: input.bytes.byteLength,
        sha256: createHash("sha256").update(input.bytes).digest("hex"),
        storageKey,
        createdBy: input.identityId,
      });
    if (created.kind === "created") {
      return { kind: "queued", versionNumber: created.versionNumber };
    }
    await removeQuietly(dependencies.storage, storageKey);
    if (created.kind === "unauthorized") return { kind: "unauthorized" };
    if (created.kind === "not_found") return { kind: "not_found" };
    return { kind: "rejected", code: created.kind };
  } catch (error) {
    await removeQuietly(dependencies.storage, storageKey);
    throw error;
  }
}

/**
 * Deletes a source with all its versions: it disappears for both roles when
 * the transaction commits, and the worker purges originals and text.
 */
export async function deleteSource(
  dependencies: ReadDependencies,
  input: { identityId: string; spaceId: string; sourceId: string },
): Promise<DeleteSourceResult> {
  if (
    !(await authorizeSpaceAction(
      dependencies.accessRepository,
      input.identityId,
      input.spaceId,
      "gestionar_fuentes",
    ))
  ) {
    return { kind: "unauthorized" };
  }
  return dependencies.sourceRepository.deleteSource({
    actorIdentityId: input.identityId,
    spaceId: input.spaceId,
    sourceId: input.sourceId,
  });
}

/** Re-queues the latest failed version, up to the manual retry limit. */
export async function retrySourceProcessing(
  dependencies: ReadDependencies,
  input: { identityId: string; spaceId: string; sourceId: string },
): Promise<RetryVersionResult> {
  if (
    !(await authorizeSpaceAction(
      dependencies.accessRepository,
      input.identityId,
      input.spaceId,
      "gestionar_fuentes",
    ))
  ) {
    return { kind: "unauthorized" };
  }
  return dependencies.sourceRepository.retryFailedVersion({
    actorIdentityId: input.identityId,
    spaceId: input.spaceId,
    sourceId: input.sourceId,
  });
}

export async function listSpaceSources(
  dependencies: ReadDependencies,
  input: { identityId: string; spaceId: string },
): Promise<SourceListing | null> {
  const space = await authorizeSpaceAction(
    dependencies.accessRepository,
    input.identityId,
    input.spaceId,
    "consultar_fuentes",
  );
  if (!space) return null;

  const canManage = allowsSpaceAction(
    "activa",
    space.role,
    "gestionar_fuentes",
  );
  return {
    role: space.role,
    canManage,
    sources: await dependencies.sourceRepository.listSources(
      input.spaceId,
      !canManage,
    ),
  };
}

export async function readSourceContent(
  dependencies: ReadDependencies,
  input: { identityId: string; spaceId: string; sourceId: string },
): Promise<{
  canManage: boolean;
  source: SourceSummary;
  sections: SourceSection[];
} | null> {
  const space = await authorizeSpaceAction(
    dependencies.accessRepository,
    input.identityId,
    input.spaceId,
    "consultar_fuentes",
  );
  if (!space) return null;

  const canManage = allowsSpaceAction(
    "activa",
    space.role,
    "gestionar_fuentes",
  );
  const source = await dependencies.sourceRepository.findSource(
    input.spaceId,
    input.sourceId,
    !canManage,
  );
  if (!source || (!canManage && source.status !== "lista")) return null;

  return {
    canManage,
    source,
    sections:
      source.status === "lista"
        ? await dependencies.sourceRepository.listCurrentSections(
            input.spaceId,
            input.sourceId,
          )
        : [],
  };
}
