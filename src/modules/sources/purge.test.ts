import { describe, expect, it } from "vitest";

import {
  type SourceFileStorage,
  type SourceRepository,
  TransientProcessingError,
} from "./contract.ts";
import { purgeDeletedSource } from "./purge.ts";

function dependencies(options: { target: boolean; storageFails?: boolean }) {
  const purged: string[] = [];
  const sourceRepository = {
    findPurgeTarget: async () =>
      options.target ? { storageKeys: ["a", "b"] } : null,
    completePurge: async (sourceId: string) => {
      purged.push(sourceId);
      return true;
    },
  } as unknown as SourceRepository;
  const storage = {
    removeMany: async () => {
      if (options.storageFails) throw new Error("offline");
    },
  } as unknown as SourceFileStorage;
  return { deps: { sourceRepository, storage }, purged };
}

describe("deleted source purge", () => {
  it("removes originals before clearing text and skips sources without a pending purge", async () => {
    const pending = dependencies({ target: true });
    await expect(
      purgeDeletedSource(pending.deps, { sourceId: "s" }),
    ).resolves.toBe("purgada");
    expect(pending.purged).toEqual(["s"]);

    const done = dependencies({ target: false });
    await expect(
      purgeDeletedSource(done.deps, { sourceId: "s" }),
    ).resolves.toBe("omitida");
  });

  it("keeps the purge pending and retryable when storage fails", async () => {
    const failing = dependencies({ target: true, storageFails: true });
    await expect(
      purgeDeletedSource(failing.deps, { sourceId: "s" }),
    ).rejects.toBeInstanceOf(TransientProcessingError);
    expect(failing.purged).toEqual([]);
  });
});
