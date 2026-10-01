import {
  createSourceBoss,
  sourceProcessingQueue,
  sourcePurgeQueue,
  startSourceBoss,
  type SourceJobData,
  type SourcePurgeJobData,
} from "../adapters/pg-boss/source-queue.ts";
import { configuredModels } from "../adapters/ai/models.ts";
import { WorkerThreadPdfExtractor } from "../adapters/pdfjs/pdf-text-extractor.ts";
import { PostgresKnowledgeRepository } from "../adapters/postgres/knowledge-repository.ts";
import { createPostgresDatabase } from "../adapters/postgres/database.ts";
import { PostgresSourceRepository } from "../adapters/postgres/source-repository.ts";
import { SupabaseSourceStorage } from "../adapters/supabase/source-storage.ts";
import {
  type PdfTextExtractor,
  TransientProcessingError,
} from "../modules/sources/contract.ts";
import type { TextEmbedder } from "../modules/knowledge/contract.ts";
import { indexPendingEmbeddings } from "../modules/knowledge/service.ts";
import { processSourceVersion } from "../modules/sources/processing.ts";
import { purgeDeletedSource } from "../modules/sources/purge.ts";

// Longer than three 60 s attempts plus their retry delays, so only a version
// whose final attempt was lost (for example, a crash) is marked as timed out.
const staleProcessingMilliseconds = 15 * 60 * 1000;
// Embedding requests per pass are bounded; after a provider failure the
// worker waits before trying again instead of retrying every minute.
const embeddingSegmentsPerPass = 64;
const embeddingBackoffMilliseconds = 10 * 60 * 1000;

export type SourceWorker = { stop(): Promise<void> };

function log(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ at: new Date().toISOString(), ...entry }));
}

export async function startSourceWorker(options: {
  databaseUrl: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  pollingIntervalSeconds?: number;
  pdfExtractor?: PdfTextExtractor;
  embedder?: TextEmbedder | null;
}): Promise<SourceWorker> {
  const connection = createPostgresDatabase(options.databaseUrl);
  const repository = new PostgresSourceRepository(connection.database, null);
  const storage = new SupabaseSourceStorage(
    options.supabaseUrl,
    options.serviceRoleKey,
  );
  const pdfExtractor = options.pdfExtractor ?? new WorkerThreadPdfExtractor();
  const embedder =
    options.embedder === undefined
      ? configuredModels(process.env).embedder
      : options.embedder;
  const knowledgeRepository = new PostgresKnowledgeRepository(
    connection.database,
  );
  let embeddingsBlockedUntil = 0;
  let indexing: Promise<void> | null = null;
  const indexEmbeddings = (versionIds?: string[]) => {
    if (!embedder || indexing || Date.now() < embeddingsBlockedUntil) {
      return indexing ?? Promise.resolve();
    }
    const startedAt = Date.now();
    indexing = indexPendingEmbeddings(
      { knowledgeRepository, embedder },
      { maxSegments: embeddingSegmentsPerPass, versionIds },
    )
      .then((saved) => {
        if (saved > 0) {
          log({
            event: "segment_embeddings_saved",
            model: embedder.model,
            saved,
            durationMs: Date.now() - startedAt,
          });
        }
      })
      .catch(() => {
        embeddingsBlockedUntil = Date.now() + embeddingBackoffMilliseconds;
        log({ event: "segment_embeddings_failed", model: embedder.model });
      })
      .finally(() => {
        indexing = null;
      });
    return indexing;
  };
  const boss = createSourceBoss(options.databaseUrl, "worker");

  try {
    await startSourceBoss(boss);
    const workOptions = {
      includeMetadata: true,
      batchSize: 1,
      pollingIntervalSeconds: options.pollingIntervalSeconds ?? 1,
    } as const;
    await boss.work<SourceJobData, void, typeof workOptions>(
      sourceProcessingQueue,
      workOptions,
      async ([job]) => {
        const startedAt = Date.now();
        const attempt = job.retryCount + 1;
        try {
          const outcome = await processSourceVersion(
            { sourceRepository: repository, storage, pdfExtractor },
            {
              versionId: job.data.versionId,
              finalAttempt: job.retryCount >= job.retryLimit,
            },
          );
          if (outcome === "lista") {
            await indexEmbeddings([job.data.versionId]);
          }
          log({
            event: "source_version_processed",
            jobId: job.id,
            versionId: job.data.versionId,
            attempt,
            outcome,
            durationMs: Date.now() - startedAt,
          });
        } catch (error) {
          log({
            event: "source_version_retry",
            jobId: job.id,
            versionId: job.data.versionId,
            attempt,
            code:
              error instanceof TransientProcessingError
                ? error.code
                : "error_interno",
            durationMs: Date.now() - startedAt,
          });
          throw error;
        }
      },
    );
    await boss.work<SourcePurgeJobData, void, typeof workOptions>(
      sourcePurgeQueue,
      workOptions,
      async ([job]) => {
        const startedAt = Date.now();
        try {
          const outcome = await purgeDeletedSource(
            { sourceRepository: repository, storage },
            { sourceId: job.data.sourceId },
          );
          log({
            event: "source_purged",
            jobId: job.id,
            sourceId: job.data.sourceId,
            attempt: job.retryCount + 1,
            outcome,
            durationMs: Date.now() - startedAt,
          });
        } catch (error) {
          log({
            event: "source_purge_retry",
            jobId: job.id,
            sourceId: job.data.sourceId,
            attempt: job.retryCount + 1,
            code:
              error instanceof TransientProcessingError
                ? error.code
                : "error_interno",
          });
          throw error;
        }
      },
    );
  } catch (error) {
    await boss.stop({ graceful: false }).catch(() => undefined);
    await connection.close();
    throw error;
  }

  const sweep = setInterval(() => {
    repository
      .failStaleProcessing(new Date(Date.now() - staleProcessingMilliseconds))
      .then((count) => {
        if (count > 0) log({ event: "source_versions_timed_out", count });
      })
      .catch(() => log({ event: "source_stale_sweep_failed" }));
    void indexEmbeddings();
    // Purges still pending after the queue's retries are enqueued again.
    repository
      .claimStalePurges(new Date(Date.now() - staleProcessingMilliseconds))
      .then(async (sourceIds) => {
        for (const sourceId of sourceIds) {
          const data: SourcePurgeJobData = { sourceId };
          await boss.send(sourcePurgeQueue, data);
        }
        if (sourceIds.length > 0) {
          log({ event: "source_purges_requeued", count: sourceIds.length });
        }
      })
      .catch(() => log({ event: "source_purge_sweep_failed" }));
  }, 60_000);
  sweep.unref();

  log({
    event: "source_worker_started",
    queue: sourceProcessingQueue,
    embeddings: embedder?.model ?? "desactivado",
  });
  void indexEmbeddings();

  return {
    async stop() {
      clearInterval(sweep);
      await indexing;
      await boss.stop({ graceful: true });
      await connection.close();
      log({ event: "source_worker_stopped" });
    },
  };
}
