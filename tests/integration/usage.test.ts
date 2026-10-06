import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresKnowledgeRepository } from "../../src/adapters/postgres/knowledge-repository.ts";
import { PostgresRouteRepository } from "../../src/adapters/postgres/route-repository.ts";
import { PostgresUsageRepository } from "../../src/adapters/postgres/usage-repository.ts";
import { SimulatedChatModel } from "../../src/adapters/ai/simulated.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import type {
  ChatModel,
  TextEmbedder,
} from "../../src/modules/knowledge/contract.ts";
import {
  askAssistant,
  indexPendingEmbeddings,
} from "../../src/modules/knowledge/service.ts";
import {
  generateRouteDraft,
  readRoute,
  requestRouteDraft,
} from "../../src/modules/routes/service.ts";
import {
  AiBudgetExceededError,
  type UsageContext,
  type UsageLimits,
} from "../../src/modules/usage/contract.ts";
import { AiMeter, ProviderCallError } from "../../src/modules/usage/meter.ts";
import {
  createAdminClient,
  createLocalTestIdentity,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
} from "../support/local-auth.ts";
import { seedReadySource } from "../support/seed-sources.ts";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const accessRepository = new PostgresAccessRepository(connection.database);
const usageRepository = new PostgresUsageRepository(connection.database);
const knowledgeRepository = new PostgresKnowledgeRepository(
  connection.database,
);
const jobs: { routeId: string; token: string }[] = [];
const routeRepository = new PostgresRouteRepository(connection.database, {
  async enqueueRouteGenerationInTransaction(_transaction, routeId, token) {
    jobs.push({ routeId, token });
  },
});
const runKey = `rf10-${randomUUID()}`;
// A namespace per run: never the prototype's ("local") nor shared ones.
const namespaces: string[] = [];
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let spaceId: string;
let otherSpaceId: string;
let sourceId: string;
let versionId: string;

// Fake rates in USD per 1M tokens: 1 token = 1 micro-dollar in and out.
const rates = {
  "falso:chat": { inputUsdPerMillion: 1, outputUsdPerMillion: 1 },
  "falso:emb": { inputUsdPerMillion: 1, outputUsdPerMillion: 0 },
};
const limits = (changes: Partial<UsageLimits> = {}): UsageLimits => ({
  globalMicroUsd: 1_000_000,
  spaceDailyMicroUsd: 200_000,
  userDailyQueries: 40,
  ...changes,
});

function meterFor(changes: Partial<UsageLimits> = {}) {
  const namespace = `t${randomUUID().slice(0, 12)}`;
  namespaces.push(namespace);
  return {
    namespace,
    meter: new AiMeter(usageRepository, {
      namespace,
      limits: limits(changes),
      rates,
    }),
  };
}

function fakeChat(
  behavior: (calls: number) => Promise<{ text: string; usage?: object }>,
) {
  let calls = 0;
  const model: ChatModel = {
    label: "falso",
    pricingKey: "falso:chat",
    async complete() {
      calls += 1;
      return (await behavior(calls)) as Awaited<
        ReturnType<ChatModel["complete"]>
      >;
    },
  };
  return { model, calls: () => calls };
}

const answer = JSON.stringify({
  estado: "respondida",
  respuesta: "Usa /v2 [1].",
  citas: [1],
});
const prompt = { system: "s", user: "u", maxOutputTokens: 100 };
const queryContext = (): UsageContext => ({
  feature: "asistente",
  spaceId,
  profileId: owner.id,
});

async function usageRows(namespace: string) {
  return connection.client<
    {
      status: string;
      kind: string;
      feature: string;
      reserved_micro_usd: string;
      cost_micro_usd: string;
      input_tokens: number | null;
    }[]
  >`
    select status, kind, feature, reserved_micro_usd, cost_micro_usd,
      input_tokens
    from public.ai_usage where namespace = ${namespace} order by created_at
  `;
}

describe("RF-10 estimated AI consumption control", () => {
  beforeAll(async () => {
    owner = await createLocalTestIdentity(admin);
    identities.push(owner);
    spaceId = (
      await bootstrapSpace(accessRepository, {
        email: owner.email,
        slug: `${runKey}-a`,
        name: "RF-10 A",
      })
    ).space.id;
    otherSpaceId = (
      await bootstrapSpace(accessRepository, {
        email: owner.email,
        slug: `${runKey}-b`,
        name: "RF-10 B",
      })
    ).space.id;
    ({ sourceId, versionId } = await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Contratos",
      sections: ["Un cambio incompatible en un contrato exige /v2."],
    }));
  }, 60_000);

  afterAll(async () => {
    for (const namespace of namespaces) {
      await connection.client`
        delete from public.ai_usage where namespace = ${namespace}
      `;
      await connection.client`
        delete from public.ai_budgets where namespace = ${namespace}
      `;
    }
    await connection.client`
      delete from public.spaces where slug like ${`${runKey}%`}
    `;
    for (const identity of identities) {
      await connection.client`
        delete from public.profiles where identity_id = ${identity.id}
      `;
      await deleteLocalTestIdentity(admin, identity.id);
    }
    await connection.close();
  });

  it("reserves a safe upper bound, then settles with the reported usage", async () => {
    const { namespace, meter } = meterFor();
    const { model } = fakeChat(async () => ({
      text: "ok",
      usage: { inputTokens: 7, outputTokens: 3 },
    }));
    await meter.chat(model, queryContext()).complete(prompt);
    const [row] = await usageRows(namespace);
    // "s" + "u" = 2 bytes + 64 framing tokens, plus 100 output tokens.
    expect(row).toMatchObject({
      status: "completada",
      kind: "conversacion",
      feature: "asistente",
      reserved_micro_usd: "166",
      cost_micro_usd: "10",
      input_tokens: 7,
    });
    // Simulated models are never metered.
    await meter.chat(new SimulatedChatModel(), queryContext()).complete({
      ...prompt,
      user: '<fragmento id="1">\nx\n</fragmento>',
    });
    expect(await usageRows(namespace)).toHaveLength(1);
  });

  it("blocks before calling the model and tells which limit applies", async () => {
    const global = meterFor({ globalMicroUsd: 100 });
    const { model, calls } = fakeChat(async () => ({ text: answer }));
    await expect(
      global.meter.chat(model, queryContext()).complete(prompt),
    ).rejects.toMatchObject({ limit: "global" });

    const space = meterFor({ spaceDailyMicroUsd: 100 });
    await expect(
      space.meter.chat(model, queryContext()).complete(prompt),
    ).rejects.toMatchObject({ limit: "espacio" });
    expect(calls()).toBe(0);
    expect(await usageRows(global.namespace)).toHaveLength(0);

    // Two queries a day across spaces; the question's embedding too.
    const user = meterFor({ userDailyQueries: 2 });
    const ok = fakeChat(async () => ({
      text: answer,
      usage: { inputTokens: 1, outputTokens: 1 },
    }));
    await user.meter.chat(ok.model, queryContext()).complete(prompt);
    await user.meter
      .chat(ok.model, {
        ...queryContext(),
        feature: "ayuda",
        spaceId: otherSpaceId,
      })
      .complete(prompt);
    await expect(
      user.meter.chat(ok.model, queryContext()).complete(prompt),
    ).rejects.toMatchObject({ limit: "usuario" });
    const embedder: TextEmbedder = {
      model: "falso:emb",
      embed: async (texts) => texts.map(() => [1]),
    };
    await expect(
      user.meter.embedder(embedder, queryContext()).embed(["hola"]),
    ).rejects.toBeInstanceOf(AiBudgetExceededError);
    // Generation is not a query: only the money limits apply to it.
    await expect(
      user.meter
        .chat(ok.model, { feature: "generacion", spaceId, profileId: null })
        .complete(prompt),
    ).resolves.toMatchObject({ text: answer });

    // A real model without a configured rate is refused before any call.
    const unpriced: ChatModel = { ...ok.model, pricingKey: "openai:otro" };
    await expect(
      user.meter.chat(unpriced, queryContext()).complete(prompt),
    ).rejects.toMatchObject({ limit: "sin_tarifa" });
  });

  it("never lets concurrent requests exceed the remaining budget", async () => {
    // Each reservation is 166 micro-dollars: 1000 fits 6 of them.
    const { namespace, meter } = meterFor({ globalMicroUsd: 1000 });
    const slow = fakeChat(
      () =>
        new Promise((resolve) => setTimeout(() => resolve({ text: "ok" }), 50)),
    );
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        meter
          .chat(slow.model, {
            feature: "generacion",
            spaceId,
            profileId: null,
          })
          .complete(prompt),
      ),
    );
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(
      6,
    );
    const rows = await usageRows(namespace);
    expect(rows).toHaveLength(6);
    expect(
      rows.reduce((total, row) => total + Number(row.cost_micro_usd), 0),
    ).toBeLessThanOrEqual(1000);
  });

  it("resets daily limits at 00:00 UTC while the global total persists", async () => {
    const { namespace, meter } = meterFor({
      spaceDailyMicroUsd: 200,
      globalMicroUsd: 400,
    });
    const { model } = fakeChat(async () => ({ text: "ok" }));
    const context: UsageContext = {
      feature: "generacion",
      spaceId,
      profileId: null,
    };
    await meter.chat(model, context).complete(prompt); // keeps 166 (uncertain)
    await expect(
      meter.chat(model, context).complete(prompt),
    ).rejects.toMatchObject({ limit: "espacio" });
    await connection.client`
      update public.ai_usage set created_at = now() - interval '1 day'
      where namespace = ${namespace}
    `;
    await meter.chat(model, context).complete(prompt);
    // 332 of 400 used in total: the global budget is not reset.
    await expect(
      meter.chat(model, { ...context, spaceId: otherSpaceId }).complete(prompt),
    ).rejects.toMatchObject({ limit: "global" });
  });

  it("settles failures once: rejected calls are released, uncertain ones keep the reservation", async () => {
    const { namespace, meter } = meterFor();
    const context = queryContext();
    const failing = (error: Error) =>
      fakeChat(async () => {
        throw error;
      }).model;
    await expect(
      meter
        .chat(failing(new ProviderCallError("401", "rechazada")), context)
        .complete(prompt),
    ).rejects.toThrow("401");
    await expect(
      meter
        .chat(failing(new ProviderCallError("timeout", "incierta")), context)
        .complete(prompt),
    ).rejects.toThrow("timeout");
    await expect(
      meter
        .chat(
          failing(
            new ProviderCallError("sin contenido", "incierta", {
              inputTokens: 5,
              outputTokens: 5,
            }),
          ),
          context,
        )
        .complete(prompt),
    ).rejects.toThrow("sin contenido");
    const rows = await usageRows(namespace);
    expect(rows.map((row) => [row.status, Number(row.cost_micro_usd)])).toEqual(
      [
        ["liberada", 0],
        ["incierta", 166],
        ["completada", 10],
      ],
    );
    // Settling again changes nothing.
    const [{ id }] = await connection.client<{ id: string }[]>`
      select id from public.ai_usage where namespace = ${namespace}
        and status = 'incierta'
    `;
    await usageRepository.settle(id, { status: "liberada" });
    expect((await usageRows(namespace))[1].cost_micro_usd).toBe("166");
  });

  it("keeps non-AI results and generation attempts when a limit blocks", async () => {
    const { meter } = meterFor({ spaceDailyMicroUsd: 100 });
    const chat = fakeChat(async () => ({ text: answer }));
    const result = await askAssistant(
      {
        accessRepository,
        knowledgeRepository,
        chatModel: chat.model,
        embedder: null,
        meter,
      },
      {
        identityId: owner.id,
        spaceId,
        question: "¿Qué exige un cambio incompatible?",
      },
    );
    expect(result).toMatchObject({ kind: "budget_exceeded", limit: "espacio" });
    if (result.kind !== "budget_exceeded") return;
    expect(result.fragments.length).toBeGreaterThan(0);
    expect(chat.calls()).toBe(0);

    // Generation: blocked before the daily attempt is used.
    const queued = await requestRouteDraft(
      { accessRepository, routeRepository },
      {
        identityId: owner.id,
        spaceId,
        objective: "Aprender a versionar contratos de API",
        sourceIds: [sourceId],
      },
    );
    if (queued.kind !== "queued") throw new Error(queued.kind);
    const attempts = async () =>
      (
        await connection.client<{ count: number }[]>`
          select count(*)::int as count from public.route_generation_attempts
          where space_id = ${spaceId}
        `
      )[0].count;
    const before = await attempts();
    await expect(
      generateRouteDraft(
        {
          routeRepository,
          knowledgeRepository,
          chatModel: chat.model,
          embedder: null,
          meter,
        },
        jobs.find((job) => job.routeId === queued.routeId)!,
      ),
    ).resolves.toBe("fallida");
    expect(await attempts()).toBe(before);
    expect(chat.calls()).toBe(0);
    expect(
      (
        await readRoute(
          { accessRepository, routeRepository },
          { identityId: owner.id, spaceId, routeId: queued.routeId },
        )
      )?.route.generationError,
    ).toBe("limite_consumo_espacio");
  });

  it("releases the reservation when the daily generation attempts are used up", async () => {
    const { namespace, meter } = meterFor();
    const queued = await requestRouteDraft(
      { accessRepository, routeRepository },
      {
        identityId: owner.id,
        spaceId: otherSpaceId,
        objective: "Aprender a versionar contratos de API",
        sourceIds: [
          (
            await seedReadySource(connection.client, {
              spaceId: otherSpaceId,
              creatorId: owner.id,
              title: "Contratos B",
              sections: [
                "Versionar contratos de API: un cambio incompatible exige /v2.",
              ],
            })
          ).sourceId,
        ],
      },
    );
    if (queued.kind !== "queued") throw new Error(queued.kind);
    // Use up the daily attempts after queuing, as concurrent drafts would.
    for (let index = 0; index < 10; index += 1) {
      if (
        !(await routeRepository.reserveGenerationAttempt(
          otherSpaceId,
          queued.routeId,
        ))
      ) {
        break;
      }
    }
    const chat = fakeChat(async () => ({ text: answer }));
    await expect(
      generateRouteDraft(
        {
          routeRepository,
          knowledgeRepository,
          chatModel: chat.model,
          embedder: null,
          meter,
        },
        jobs.find((job) => job.routeId === queued.routeId)!,
      ),
    ).resolves.toBe("fallida");
    expect(chat.calls()).toBe(0);
    expect(
      (await usageRows(namespace)).map((row) => [
        row.status,
        Number(row.cost_micro_usd),
      ]),
    ).toEqual([["liberada", 0]]);
  });

  it("stops indexing at the limit and leaves the segments pending", async () => {
    const { namespace, meter } = meterFor({ spaceDailyMicroUsd: 10 });
    let requests = 0;
    const embedder: TextEmbedder = {
      model: "falso:emb",
      embed: async (texts) => {
        requests += 1;
        return texts.map(() => [1]);
      },
    };
    const pendingBefore = (
      await knowledgeRepository.listSegmentsMissingEmbeddings(
        embedder.model,
        100,
        [versionId],
      )
    ).length;
    expect(pendingBefore).toBeGreaterThan(0);
    await expect(
      indexPendingEmbeddings(
        { knowledgeRepository, embedder, meter },
        // Only this test's version: other local data is never touched.
        { maxSegments: 100, versionIds: [versionId] },
      ),
    ).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(requests).toBe(0);
    expect(await usageRows(namespace)).toHaveLength(0);
    expect(
      (
        await knowledgeRepository.listSegmentsMissingEmbeddings(
          embedder.model,
          100,
          [versionId],
        )
      ).length,
    ).toBe(pendingBefore);
  });
});
