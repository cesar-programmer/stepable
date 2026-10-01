import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresKnowledgeRepository } from "../../src/adapters/postgres/knowledge-repository.ts";
import { PostgresRouteRepository } from "../../src/adapters/postgres/route-repository.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import type { ChatModel } from "../../src/modules/knowledge/contract.ts";
import type { RouteStep } from "../../src/modules/routes/contract.ts";
import {
  deleteRouteStep,
  editRouteStep,
  generateRouteDraft,
  listSpaceRoutes,
  moveRouteStep,
  publishRoute,
  readRoute,
  requestRouteDraft,
  requestRouteRegeneration,
} from "../../src/modules/routes/service.ts";
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
const knowledgeRepository = new PostgresKnowledgeRepository(
  connection.database,
);
const jobs: { routeId: string; token: string }[] = [];
const routeRepository = new PostgresRouteRepository(connection.database, {
  async enqueueRouteGenerationInTransaction(_transaction, routeId, token) {
    jobs.push({ routeId, token });
  },
});
const dependencies = { accessRepository, routeRepository };
const runKey = `e4-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let foreignOwner: LocalTestIdentity;
let spaceId: string;
let foreignSpaceId: string;
let apiSource: { sourceId: string; versionId: string };
let deploySource: { sourceId: string; versionId: string };
let unselectedSourceId: string;
let foreignSourceId: string;

/** Builds a valid generated route that cites the first fragments it got. */
function routeModel(override?: (user: string) => string): {
  model: ChatModel;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    model: {
      label: "prueba",
      async complete({ user }) {
        calls.push(user);
        if (override) return { text: override(user) };
        const refs = [...user.matchAll(/<fragmento id="(\d+)"/g)].map((m) =>
          Number(m[1]),
        );
        const pasos = [0, 1, 2].map((index) => ({
          titulo: `Paso ${index + 1}`,
          leccion: `Contenido del paso [${refs[index % refs.length]}]`,
          citas: [refs[index % refs.length]],
          pregunta: `Pregunta ${index + 1}`,
          opciones: ["Correcta", "Incorrecta", "Otra"],
          correcta: 0,
          explicacion: "Según la fuente.",
        }));
        return {
          text: JSON.stringify({
            estado: "generado",
            titulo: "Ruta API",
            pasos,
          }),
          usage: { inputTokens: 100, outputTokens: 50 },
        };
      },
    },
  };
}

async function generate(routeId: string, model: ChatModel | null) {
  const job = jobs.filter((item) => item.routeId === routeId).at(-1);
  if (!job) throw new Error("Sin trabajo encolado");
  return generateRouteDraft(
    { routeRepository, knowledgeRepository, chatModel: model, embedder: null },
    job,
  );
}

const request = (
  objective: string,
  sourceIds: string[],
  identity: LocalTestIdentity = owner,
) =>
  requestRouteDraft(dependencies, {
    identityId: identity.id,
    spaceId,
    objective,
    sourceIds,
  });

async function routeAs(identity: LocalTestIdentity, routeId: string) {
  return readRoute(dependencies, {
    identityId: identity.id,
    spaceId,
    routeId,
  });
}

async function editable(routeId: string) {
  const result = await routeAs(owner, routeId);
  if (!result) throw new Error("Ruta no encontrada");
  return result.route;
}

const stepEdit = (step: RouteStep, changes: Partial<RouteStep> = {}) => ({
  title: changes.title ?? step.title,
  lesson: changes.lesson ?? step.lesson,
  question: changes.question ?? step.question,
  options: changes.options ?? step.options,
  correctOption: changes.correctOption ?? step.correctOption ?? 0,
  explanation: changes.explanation ?? step.explanation ?? "",
});

describe("E4.1 AI-drafted onboarding routes", () => {
  beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );
    [owner, member, foreignOwner] = identities;
    spaceId = (
      await bootstrapSpace(accessRepository, {
        email: owner.email,
        slug: `${runKey}-main`,
        name: "E4 main",
      })
    ).space.id;
    foreignSpaceId = (
      await bootstrapSpace(accessRepository, {
        email: foreignOwner.email,
        slug: `${runKey}-foreign`,
        name: "E4 foreign",
      })
    ).space.id;
    await connection.client`
      insert into public.profiles (identity_id) values (${member.id})
      on conflict (identity_id) do nothing
    `;
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${spaceId}, ${member.id}, 'integrante')
    `;
    const seed = (title: string, text: string, target = spaceId, by = owner) =>
      seedReadySource(connection.client, {
        spaceId: target,
        creatorId: by.id,
        title,
        sections: [text],
      });
    apiSource = await seed(
      "Contratos de API",
      "Cada cambio incompatible en un contrato de API exige publicar una nueva versión mayor en la ruta.",
    );
    deploySource = await seed(
      "Despliegues",
      "Los despliegues a producción de la API se hacen martes y jueves con revisión aprobada.",
    );
    unselectedSourceId = (
      await seed("Íconos", "Contrato de API secreto de la fuente no elegida.")
    ).sourceId;
    foreignSourceId = (
      await seed(
        "Ajena",
        "Contrato de API ajeno.",
        foreignSpaceId,
        foreignOwner,
      )
    ).sourceId;
  }, 60_000);

  afterAll(async () => {
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

  it("lets only responsibles request drafts from up to 5 sources of their space", async () => {
    const objective = "Aprender a versionar y publicar contratos de API";
    await expect(
      request(objective, [apiSource.sourceId], member),
    ).resolves.toEqual({ kind: "unauthorized" });
    await expect(
      request(objective, [apiSource.sourceId], foreignOwner),
    ).resolves.toEqual({ kind: "unauthorized" });
    await expect(request(objective, [foreignSourceId])).resolves.toEqual({
      kind: "fuentes_no_disponibles",
    });
    await expect(
      request(
        objective,
        Array.from({ length: 6 }, () => randomUUID()),
      ),
    ).resolves.toEqual({ kind: "invalid" });
    await expect(request("corto", [apiSource.sourceId])).resolves.toEqual({
      kind: "invalid",
    });
  });

  it("generates once per job from the selected sources and builds citations", async () => {
    const queued = await request(
      "Aprender a versionar y publicar contratos de API",
      [apiSource.sourceId, deploySource.sourceId],
    );
    if (queued.kind !== "queued") throw new Error(queued.kind);
    const { model, calls } = routeModel();

    await expect(generate(queued.routeId, model)).resolves.toBe("lista");
    // A re-delivered job never repeats the paid call.
    await expect(generate(queued.routeId, model)).resolves.toBe("omitida");
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain("secreto");
    expect(calls[0]).not.toContain("ajeno");

    const route = await editable(queued.routeId);
    expect(route).toMatchObject({
      title: "Ruta API",
      status: "borrador",
      generationStatus: "lista",
      needsReview: false,
    });
    expect(route.steps).toHaveLength(3);
    const cited = route.steps.flatMap((step) =>
      step.citations.map((citation) => citation.sourceId),
    );
    expect(cited.every((id) => id !== unselectedSourceId)).toBe(true);
    expect(route.steps[0].citations[0]).toMatchObject({
      state: "vigente",
      versionNumber: 1,
    });

    // Drafts are invisible to members and other spaces.
    expect(await routeAs(member, queued.routeId)).toBeNull();
    expect(
      await readRoute(dependencies, {
        identityId: foreignOwner.id,
        spaceId,
        routeId: queued.routeId,
      }),
    ).toBeNull();
    expect(
      (await listSpaceRoutes(dependencies, { identityId: member.id, spaceId }))
        ?.routes,
    ).toEqual([]);
  });

  it("reports insufficient evidence without inventing steps", async () => {
    const declines = routeModel(() =>
      JSON.stringify({ estado: "insuficiente", pasos: [] }),
    );
    const queued = await request("Aprender la API de pagos con contratos", [
      apiSource.sourceId,
    ]);
    if (queued.kind !== "queued") throw new Error(queued.kind);
    await expect(generate(queued.routeId, declines.model)).resolves.toBe(
      "insuficiente",
    );
    expect((await editable(queued.routeId)).steps).toEqual([]);

    // No matching fragments: no provider call at all.
    const noMatch = routeModel();
    const unrelated = await request("Conocer la política de vacaciones", [
      apiSource.sourceId,
    ]);
    if (unrelated.kind !== "queued") throw new Error(unrelated.kind);
    await expect(generate(unrelated.routeId, noMatch.model)).resolves.toBe(
      "insuficiente",
    );
    expect(noMatch.calls).toHaveLength(0);

    const invented = routeModel(() =>
      JSON.stringify({
        estado: "generado",
        titulo: "Mal",
        pasos: [1, 2, 3].map(() => ({
          titulo: "Paso",
          leccion: "Inventado [9]",
          citas: [9],
          pregunta: "¿?",
          opciones: ["a", "b", "c"],
          correcta: 0,
          explicacion: "x",
        })),
      }),
    );
    const bad = await request("Aprender contratos de API con ejemplos", [
      apiSource.sourceId,
    ]);
    if (bad.kind !== "queued") throw new Error(bad.kind);
    await expect(generate(bad.routeId, invented.model)).resolves.toBe(
      "fallida",
    );
    expect(await editable(bad.routeId)).toMatchObject({
      generationError: "borrador_no_valido",
      steps: [],
    });
  });

  it("enforces 5 generation attempts per space and day, counting provider calls", async () => {
    const [{ used }] = await connection.client`
      select count(*)::int as used from public.route_generation_attempts
      where space_id = ${spaceId}
    `;
    // Three provider calls so far (lista, insuficiente, fallida).
    expect(used).toBe(3);
    const fourth = await request("Aprender contratos de API paso a paso", [
      apiSource.sourceId,
    ]);
    const fifth = await request("Aprender contratos de API en detalle", [
      apiSource.sourceId,
    ]);
    if (fourth.kind !== "queued" || fifth.kind !== "queued") {
      throw new Error("No se encolaron");
    }
    // Queued generations already count against the limit.
    await expect(
      request("Aprender contratos de API una vez más", [apiSource.sourceId]),
    ).resolves.toEqual({ kind: "limite_diario" });
    await generate(fourth.routeId, routeModel().model);
    await generate(fifth.routeId, routeModel().model);
    await expect(
      requestRouteRegeneration(dependencies, {
        identityId: owner.id,
        spaceId,
        routeId: fifth.routeId,
      }),
    ).resolves.toEqual({ kind: "limite_diario" });

    // Even a direct reservation is refused once 5 calls were made.
    await expect(
      routeRepository.reserveGenerationAttempt(spaceId, fifth.routeId),
    ).resolves.toBe(false);
    await connection.client`
      delete from public.route_generation_attempts where space_id = ${spaceId}
    `;
  });

  it("edits, reorders and deletes steps with conflict detection, then publishes a stable version", async () => {
    const queued = await request("Aprender contratos y despliegues de API", [
      apiSource.sourceId,
      deploySource.sourceId,
    ]);
    if (queued.kind !== "queued") throw new Error(queued.kind);
    await generate(queued.routeId, routeModel().model);
    let route = await editable(queued.routeId);
    const [first, second, third] = route.steps;
    const base = { identityId: owner.id, spaceId, routeId: queued.routeId };

    await expect(
      editRouteStep(dependencies, {
        ...base,
        identityId: member.id,
        editVersion: route.editVersion,
        stepId: first.id,
        edit: stepEdit(first),
      }),
    ).resolves.toEqual({ kind: "unauthorized" });
    await expect(
      editRouteStep(dependencies, {
        ...base,
        editVersion: route.editVersion,
        stepId: first.id,
        edit: stepEdit(first, { lesson: "Cita inventada [8]" }),
      }),
    ).resolves.toEqual({ kind: "invalid" });
    await expect(
      editRouteStep(dependencies, {
        ...base,
        editVersion: route.editVersion,
        stepId: first.id,
        edit: stepEdit(first, {
          title: "Versionar contratos",
          options: ["Mayor en la ruta", "Menor", "Ninguna"],
          correctOption: 0,
        }),
      }),
    ).resolves.toEqual({ kind: "ok" });
    // The stale edit version is reported instead of overwriting.
    await expect(
      editRouteStep(dependencies, {
        ...base,
        editVersion: route.editVersion,
        stepId: second.id,
        edit: stepEdit(second, { title: "Pisado" }),
      }),
    ).resolves.toEqual({ kind: "conflict" });

    route = await editable(queued.routeId);
    await expect(
      moveRouteStep(dependencies, {
        ...base,
        editVersion: route.editVersion,
        stepId: third.id,
        direction: "up",
      }),
    ).resolves.toEqual({ kind: "ok" });
    route = await editable(queued.routeId);
    await expect(
      deleteRouteStep(dependencies, {
        ...base,
        editVersion: route.editVersion,
        stepId: third.id,
      }),
    ).resolves.toEqual({ kind: "ok" });
    route = await editable(queued.routeId);
    expect(route.steps.map((step) => [step.position, step.id])).toEqual([
      [1, first.id],
      [2, second.id],
    ]);
    expect(route.steps[0].title).toBe("Versionar contratos");

    await expect(
      publishRoute(dependencies, {
        ...base,
        identityId: member.id,
        editVersion: route.editVersion,
      }),
    ).resolves.toEqual({ kind: "unauthorized" });
    await expect(
      publishRoute(dependencies, { ...base, editVersion: route.editVersion }),
    ).resolves.toEqual({ kind: "ok" });

    // Members read the published version without the answer key.
    const published = await routeAs(member, queued.routeId);
    expect(published?.route.status).toBe("publicada");
    expect(published?.route.steps[0]).toMatchObject({
      title: "Versionar contratos",
      correctOption: null,
      explanation: null,
    });
    const after = await editable(queued.routeId);
    await expect(
      editRouteStep(dependencies, {
        ...base,
        editVersion: after.editVersion,
        stepId: first.id,
        edit: stepEdit(first, { title: "Cambio tardío" }),
      }),
    ).resolves.toEqual({ kind: "not_editable" });
    await expect(requestRouteRegeneration(dependencies, base)).resolves.toEqual(
      { kind: "not_editable" },
    );

    // Replacing and deleting cited sources flags the route but keeps content.
    const newVersionId = randomUUID();
    await connection.client`
      insert into public.source_versions
        (id, source_id, space_id, number, format, byte_size, sha256,
         storage_key, status, section_count, processed_at, created_by)
      values (${newVersionId}, ${apiSource.sourceId}, ${spaceId}, 2, 'markdown',
        100, ${"a".repeat(64)}, ${`${spaceId}/${apiSource.sourceId}/${newVersionId}`},
        'lista', 1, now(), ${owner.id})
    `;
    await connection.client`
      update public.sources set current_version_id = ${newVersionId}
      where id = ${apiSource.sourceId}
    `;
    await connection.client`
      update public.sources
      set status = 'eliminada', deleted_at = now(), deleted_by = ${owner.id}
      where id = ${deploySource.sourceId}
    `;
    const flagged = await routeAs(member, queued.routeId);
    expect(flagged?.route.needsReview).toBe(true);
    expect(flagged?.route.steps[0].title).toBe("Versionar contratos");
    const states = flagged?.route.steps.flatMap((step) =>
      step.citations.map((citation) => [citation.sourceId, citation.state]),
    );
    expect(states).toEqual(
      expect.arrayContaining([
        [apiSource.sourceId, "version_anterior"],
        [deploySource.sourceId, "fuente_eliminada"],
      ]),
    );
  });

  it("refuses to publish a draft that cites a version no longer current", async () => {
    const source = await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Versionado",
      sections: [
        "El versionado semántico de contratos usa mayor, menor y parche.",
      ],
    });
    const queued = await request("Aprender versionado semántico de contratos", [
      source.sourceId,
    ]);
    if (queued.kind !== "queued") throw new Error(queued.kind);
    await expect(generate(queued.routeId, routeModel().model)).resolves.toBe(
      "lista",
    );
    // The source is replaced after the draft was generated.
    const newVersionId = randomUUID();
    await connection.client`
      insert into public.source_versions
        (id, source_id, space_id, number, format, byte_size, sha256,
         storage_key, status, section_count, processed_at, created_by)
      values (${newVersionId}, ${source.sourceId}, ${spaceId}, 2, 'markdown',
        100, ${"b".repeat(64)}, ${`${spaceId}/${source.sourceId}/${newVersionId}`},
        'lista', 1, now(), ${owner.id})
    `;
    await connection.client`
      update public.sources set current_version_id = ${newVersionId}
      where id = ${source.sourceId}
    `;
    const draft = await editable(queued.routeId);
    expect(draft.needsReview).toBe(true);
    await expect(
      publishRoute(dependencies, {
        identityId: owner.id,
        spaceId,
        routeId: queued.routeId,
        editVersion: draft.editVersion,
      }),
    ).resolves.toEqual({ kind: "citas_no_vigentes" });
  });
});
