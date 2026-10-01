import { sql } from "drizzle-orm";
import { fromDrizzle, PgBoss, type QueueOptions } from "pg-boss";

import type { StepableDatabase } from "../postgres/database.ts";

type Transaction = Parameters<
  Parameters<StepableDatabase["transaction"]>[0]
>[0];

export const sourceProcessingQueue = "procesar-fuente";

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

export type SourceJobData = { versionId: string };

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

export async function startSourceBoss(boss: PgBoss): Promise<void> {
  await boss.start();
  await boss.createQueue(sourceProcessingQueue, sourceProcessingQueueOptions);
}

export class PgBossSourceQueue {
  readonly #boss: PgBoss;

  constructor(boss: PgBoss) {
    this.#boss = boss;
  }

  async enqueueInTransaction(
    transaction: Transaction,
    versionId: string,
  ): Promise<void> {
    const data: SourceJobData = { versionId };
    const jobId = await this.#boss.send(sourceProcessingQueue, data, {
      db: fromDrizzle(transaction, sql),
    });
    if (!jobId) {
      throw new Error("pg-boss no registró el trabajo de procesamiento.");
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
