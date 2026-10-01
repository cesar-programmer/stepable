import { describe, expect, it } from "vitest";

import {
  type ProcessingErrorCode,
  type SourceFileStorage,
  type SourceRepository,
  TransientProcessingError,
} from "./contract.ts";
import { processSourceVersion } from "./processing.ts";

function fakes(options: { download?: () => Promise<Uint8Array> } = {}) {
  const failures: ProcessingErrorCode[] = [];
  let completedSections = 0;
  const repository = {
    startProcessing: async (versionId: string) => ({
      versionId,
      spaceId: "space",
      storageKey: "key",
      format: "markdown" as const,
    }),
    completeProcessing: async (_versionId: string, sections: unknown[]) => {
      completedSections = sections.length;
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
  return {
    dependencies: { sourceRepository: repository, storage },
    failures,
    completed: () => completedSections,
  };
}

describe("source version processing", () => {
  it("marks a valid Markdown version as ready", async () => {
    const { dependencies, completed } = fakes();
    await expect(
      processSourceVersion(dependencies, {
        versionId: "v",
        finalAttempt: false,
      }),
    ).resolves.toBe("lista");
    expect(completed()).toBe(1);
  });

  it("fails permanent content errors without asking for a retry", async () => {
    const { dependencies, failures } = fakes({
      download: async () => new TextEncoder().encode("   "),
    });
    await expect(
      processSourceVersion(dependencies, {
        versionId: "v",
        finalAttempt: false,
      }),
    ).resolves.toBe("fallida");
    expect(failures).toEqual(["contenido_vacio"]);
  });

  it("retries transient errors and fails them only on the final attempt", async () => {
    const unavailable = async () => {
      throw new Error("offline");
    };
    const retry = fakes({ download: unavailable });
    await expect(
      processSourceVersion(retry.dependencies, {
        versionId: "v",
        finalAttempt: false,
      }),
    ).rejects.toBeInstanceOf(TransientProcessingError);
    expect(retry.failures).toEqual([]);

    const final = fakes({ download: unavailable });
    await expect(
      processSourceVersion(final.dependencies, {
        versionId: "v",
        finalAttempt: true,
      }),
    ).resolves.toBe("fallida");
    expect(final.failures).toEqual(["almacenamiento_no_disponible"]);
  });
});
