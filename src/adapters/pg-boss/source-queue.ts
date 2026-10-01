import { sql } from "drizzle-orm";
import { fromDrizzle, PgBoss, type QueueOptions } from "pg-boss";

import { namespacedQueue, parseJobNamespace } from "../../lib/job-namespace.ts";
import type { StepableDatabase } from "../postgres/database.ts";

type Transaction = Parameters<
  Parameters<StepableDatabase["transaction"]>[0]
>[0];

export const sourceProcessingQueue = "procesar-fuente";
export const sourcePurgeQueue = "purgar-fuente";
export const routeGenerationQueue = "generar-ruta";

// Paid generation: no automatic retries; a crashed attempt is expired and the
// worker sweep marks the draft as failed so the responsible can retry.
export const routeGenerationQueueOptions: QueueOptions = {
  retryLimit: 0,
  expireInSeconds: 180,
  deleteAfterSeconds: 2 * 24 * 60 * 60,
};

// Three attempts in total (one plus two retries), 60 s per attempt. An attempt
// that exceeds expireInSeconds, including a worker crash, is retried by the
// pg-boss supervisor running in the worker process.
export const sourceProcessingQueueOptions: QueueOptions = {
  retryLimit: 2,
  retryDelay: 30,
  retryBackoff: true,
  retryDelayMax: 120,
  expireInSeconds: 60,
  deleteAfterSeconds: 2 * 24 * 60 * 60,
};

/** Queue names of one job namespace ("local" keeps the base names). */
export function queueNamesFor(namespace: string) {
  return {
    processing: namespacedQueue(sourceProcessingQueue, namespace),
    purge: namespacedQueue(sourcePurgeQueue, namespace),
    routeGeneration: namespacedQueue(routeGenerationQueue, namespace),
  };
}

export type SourceJobData = { versionId: string };
export type SourcePurgeJobData = { sourceId: string };
export type RouteGenerationJobData = { routeId: string; token: string };

export function createSourceBoss(
  connectionString: string,
  role: "web" | "worker",
): PgBoss {
  const boss = new PgBoss({
    connectionString,
    application_name: `stepable-${role}`,
    max: role === "web" ? 2 : 4,
    // The schema is created by supabase/migrations, never at runtime.
    migrate: false,
    createSchema: false,
    schedule: false,
    supervise: role === "worker",
  });
  boss.on("error", (error) => {
    console.error(
      JSON.stringify({
        event: "pg_boss_error",
        role,
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  });
  return boss;
}

export async function startSourceBoss(
  boss: PgBoss,
  namespace: string = parseJobNamespace(process.env),
): Promise<void> {
  const queues = queueNamesFor(namespace);
  await boss.start();
  await boss.createQueue(queues.processing, sourceProcessingQueueOptions);
  await boss.createQueue(queues.purge, sourceProcessingQueueOptions);
  await boss.createQueue(queues.routeGeneration, routeGenerationQueueOptions);
}

export class PgBossSourceQueue {
  readonly #boss: PgBoss;
  readonly #queues: ReturnType<typeof queueNamesFor>;

  constructor(
    boss: PgBoss,
    namespace: string = parseJobNamespace(process.env),
  ) {
    this.#boss = boss;
    this.#queues = queueNamesFor(namespace);
  }

  async enqueueInTransaction(
    transaction: Transaction,
    versionId: string,
  ): Promise<void> {
    const data: SourceJobData = { versionId };
    const jobId = await this.#boss.send(this.#queues.processing, data, {
      db: fromDrizzle(transaction, sql),
    });
    if (!jobId) {
      throw new Error("pg-boss no registró el trabajo de procesamiento.");
    }
  }

  async enqueueRouteGenerationInTransaction(
    transaction: Transaction,
    routeId: string,
    token: string,
  ): Promise<void> {
    const data: RouteGenerationJobData = { routeId, token };
    const jobId = await this.#boss.send(this.#queues.routeGeneration, data, {
      db: fromDrizzle(transaction, sql),
    });
    if (!jobId) {
      throw new Error("pg-boss no registró el trabajo de generación.");
    }
  }

  async enqueuePurgeInTransaction(
    transaction: Transaction,
    sourceId: string,
  ): Promise<void> {
    const data: SourcePurgeJobData = { sourceId };
    const jobId = await this.#boss.send(this.#queues.purge, data, {
      db: fromDrizzle(transaction, sql),
    });
    if (!jobId) {
      throw new Error("pg-boss no registró el trabajo de purga.");
    }
  }
}

const globalQueue = globalThis as typeof globalThis & {
  stepableSourceQueue?: {
    connectionString: string;
    ready: Promise<PgBossSourceQueue>;
  };
};

/** Shared web-process instance; it only enqueues and never supervises. */
export function getApplicationSourceQueue(
  connectionString: string,
): Promise<PgBossSourceQueue> {
  const cached = globalQueue.stepableSourceQueue;
  if (cached && cached.connectionString === connectionString) {
    return cached.ready;
  }

  const boss = createSourceBoss(connectionString, "web");
  const ready = startSourceBoss(boss).then(() => new PgBossSourceQueue(boss));
  ready.catch(() => {
    if (globalQueue.stepableSourceQueue?.ready === ready) {
      globalQueue.stepableSourceQueue = undefined;
    }
  });
  globalQueue.stepableSourceQueue = { connectionString, ready };
  return ready;
}
