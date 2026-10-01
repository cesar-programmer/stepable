import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createSourceBoss,
  PgBossSourceQueue,
  queueNamesFor,
  startSourceBoss,
} from "../../src/adapters/pg-boss/source-queue.ts";
import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresRouteRepository } from "../../src/adapters/postgres/route-repository.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import type {
  ChatModel,
  TextEmbedder,
} from "../../src/modules/knowledge/contract.ts";
import { requestRouteDraft } from "../../src/modules/routes/service.ts";
import {
  startSourceWorker,
  type SourceWorker,
} from "../../src/worker/source-worker.ts";
import {
  createAdminClient,
  createLocalTestIdentity,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
} from "../support/local-auth.ts";
import { seedReadySource } from "../support/seed-sources.ts";

// A worker of another namespace stands in for a developer's real worker. Its
// model and embedder only count calls: nothing reaches a provider.
const otherNamespace = `otro-${randomUUID().slice(0, 8)}`;
const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const accessRepository = new PostgresAccessRepository(connection.database);
const boss = createSourceBoss(config.databaseUrl, "web");
const runKey = `aislamiento-${randomUUID()}`;
const calls = { chat: 0, embeddings: 0 };
const countingModel: ChatModel = {
  label: "contador",
  async complete() {
    calls.chat += 1;
    return { text: JSON.stringify({ estado: "insuficiente", pasos: [] }) };
  },
};
const countingEmbedder: TextEmbedder = {
  model: "prueba:contador",
  async embed(texts) {
    calls.embeddings += 1;
    return texts.map(() => [1, 0, 0]);
  },
};
let owner: LocalTestIdentity;
let spaceId: string;
let sourceId: string;
let otherWorker: SourceWorker;

const settle = () => new Promise((resolve) => setTimeout(resolve, 3_000));

function routeRepositoryFor(namespace: string) {
  return new PostgresRouteRepository(
    connection.database,
    new PgBossSourceQueue(boss, namespace),
  );
}

async function queueRoute(namespace: string) {
  const queued = await requestRouteDraft(
    { accessRepository, routeRepository: routeRepositoryFor(namespace) },
    {
      identityId: owner.id,
      spaceId,
      objective: "Aprender a versionar contratos de API",
      sourceIds: [sourceId],
    },
  );
  if (queued.kind !== "queued") throw new Error(queued.kind);
  return queued.routeId;
}

describe("test work is isolated from workers of other namespaces", () => {
  beforeAll(async () => {
    expect(process.env.STEPABLE_JOB_NAMESPACE).toBe("pruebas");
    owner = await createLocalTestIdentity(admin);
    spaceId = (
      await bootstrapSpace(accessRepository, {
        email: owner.email,
        slug: runKey,
        name: "Aislamiento de trabajos",
      })
    ).space.id;
    sourceId = (
      await seedReadySource(connection.client, {
        spaceId,
        creatorId: owner.id,
        title: "Contratos de API",
        sections: ["Para versionar contratos de API se usa una versión mayor."],
      })
    ).sourceId;
    await startSourceBoss(boss, "pruebas");
    await startSourceBoss(boss, otherNamespace);
    otherWorker = await startSourceWorker({
      databaseUrl: config.databaseUrl,
      supabaseUrl: config.apiUrl,
      serviceRoleKey: config.serviceRoleKey,
      pollingIntervalSeconds: 0.5,
      jobNamespace: otherNamespace,
      routeModel: countingModel,
      embedder: countingEmbedder,
    });
  }, 60_000);

  afterAll(async () => {
    await otherWorker?.stop();
    for (const name of Object.values(queueNamesFor(otherNamespace))) {
      await boss.deleteQueue(name).catch(() => undefined);
    }
    await boss.stop({ graceful: false });
    await connection.client`delete from public.spaces where slug = ${runKey}`;
    await connection.client`
      delete from public.profiles where identity_id = ${owner.id}
    `;
    await deleteLocalTestIdentity(admin, owner.id);
    await connection.close();
  }, 30_000);

  it("records the namespace of spaces created by test commands", async () => {
    const [space] = await connection.client`
      select job_namespace from public.spaces where id = ${spaceId}
    `;
    expect(space.job_namespace).toBe("pruebas");
  });

  it("never delivers test jobs to another namespace's queues", async () => {
    await queueRoute("pruebas");
    await settle();
    expect(calls.chat).toBe(0);
  }, 20_000);

  it("refuses misrouted test jobs and never indexes test spaces", async () => {
    // A test job sent to the other worker's queue (e.g. a reused dev server).
    const routeId = await queueRoute(otherNamespace);
    await settle();
    expect(calls.chat).toBe(0);
    const [route] = await connection.client`
      select generation_status from public.routes where id = ${routeId}
    `;
    expect(route.generation_status).toBe("en_cola");
    // The worker's embedding sweep skipped the unindexed test segments.
    expect(calls.embeddings).toBe(0);
    // Other test workers may legitimately process "pruebas" jobs in
    // parallel; the misrouted route itself must have no provider attempt.
    const [attempts] = await connection.client`
      select count(*)::int as count from public.route_generation_attempts
      where route_id = ${routeId}
    `;
    expect(attempts.count).toBe(0);
  }, 20_000);
});
