import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresKnowledgeRepository } from "../../src/adapters/postgres/knowledge-repository.ts";
import { PostgresLearningRepository } from "../../src/adapters/postgres/learning-repository.ts";
import { PostgresRouteRepository } from "../../src/adapters/postgres/route-repository.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import type { ChatModel } from "../../src/modules/knowledge/contract.ts";
import { askStepHelp } from "../../src/modules/learning/help.ts";
import {
  stepExplanationMarker,
  stepHintMarker,
} from "../../src/modules/learning/help-prompt.ts";
import { answerStep, startRoute } from "../../src/modules/learning/service.ts";
import {
  createAdminClient,
  createLocalTestIdentity,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
} from "../support/local-auth.ts";
import { seedPublishedRoute } from "../support/seed-routes.ts";
import { seedReadySource } from "../support/seed-sources.ts";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const accessRepository = new PostgresAccessRepository(connection.database);
const learningDependencies = {
  accessRepository,
  routeRepository: new PostgresRouteRepository(connection.database, null),
  learningRepository: new PostgresLearningRepository(connection.database),
};
const runKey = `e5-3-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
const secretExplanation = "EXPLICACION-RESERVADA del paso uno";
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let revoked: LocalTestIdentity;
let foreign: LocalTestIdentity;
let spaceId: string;
let contractsSourceId: string;
let routeId: string;
let stepIds: string[];
let changedRoute: { routeId: string; stepIds: string[] };
let deletedRoute: { routeId: string; stepIds: string[] };

const calls: { system: string; user: string }[] = [];
const citeFirstReply = {
  estado: "respondida",
  respuesta: "Piensa en la compatibilidad [1].",
  citas: [1],
};
// A test may replace the next reply; it is reset after each call.
let nextReply: object | null = null;
const citeFirst: ChatModel = {
  label: "prueba",
  async complete({ system, user }) {
    calls.push({ system, user });
    const reply = nextReply ?? citeFirstReply;
    nextReply = null;
    return { text: JSON.stringify(reply) };
  },
};

const help = (
  identity: LocalTestIdentity,
  overrides: Partial<{
    routeId: string;
    stepId: string;
    question: string;
  }> = {},
) =>
  askStepHelp(
    {
      ...learningDependencies,
      knowledgeRepository: new PostgresKnowledgeRepository(connection.database),
      chatModel: citeFirst,
      embedder: null,
    },
    {
      identityId: identity.id,
      spaceId,
      routeId,
      stepId: stepIds[0],
      question: "",
      ...overrides,
    },
  );

async function progressSnapshot(identity: LocalTestIdentity) {
  return connection.client`
    select p.route_id, p.started_at, p.completed_at,
      (select count(*) from public.route_step_attempts a
        where a.profile_id = p.profile_id and a.route_id = p.route_id)::int
        as attempts
    from public.route_progress p
    where p.profile_id = ${identity.id}
    order by p.route_id
  `;
}

describe("E5.3 contextual help inside a step", () => {
  beforeAll(async () => {
    for (let index = 0; index < 4; index += 1) {
      identities.push(await createLocalTestIdentity(admin));
    }
    [owner, member, revoked, foreign] = identities;
    spaceId = (
      await bootstrapSpace(accessRepository, {
        email: owner.email,
        slug: `${runKey}-main`,
        name: "E5.3 main",
      })
    ).space.id;
    await bootstrapSpace(accessRepository, {
      email: foreign.email,
      slug: `${runKey}-foreign`,
      name: "E5.3 foreign",
    });
    for (const identity of [member, revoked]) {
      await connection.client`
        insert into public.profiles (identity_id) values (${identity.id})
        on conflict (identity_id) do nothing
      `;
      await connection.client`
        insert into public.memberships (space_id, profile_id, role)
        values (${spaceId}, ${identity.id}, 'integrante')
      `;
    }

    const contracts = await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Guía de contratos",
      sections: [
        "Un cambio incompatible en un contrato exige una versión mayor.",
      ],
    });
    contractsSourceId = contracts.sourceId;
    await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Manual de despliegues",
      sections: ["Los contratos de despliegue se revisan los martes."],
    });
    ({ routeId, stepIds } = await seedPublishedRoute(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Ruta de contratos",
      source: { ...contracts, title: "Guía de contratos" },
      steps: [
        {
          title: "Versionar contratos",
          lesson: "Un cambio incompatible exige una versión mayor [1].",
          question: "¿Qué exige un cambio incompatible en un contrato?",
          code: {
            content: 'if (incompatible) {\n  ruta = "/v2";\n}',
            language: "ts",
            origin: "ilustrativo",
          },
          options: ["Una versión mayor", "Una versión menor", "Nada"],
          correct: 0,
          explanation: secretExplanation,
        },
        {
          title: "Revisar contratos",
          lesson: "Otra persona revisa el contrato [1].",
          question: "¿Quién revisa el contrato?",
          options: ["Otra persona", "Nadie", "El autor"],
          correct: 0,
          explanation: "Siempre revisa otra persona.",
        },
      ],
    }));

    // A lesson written from a version that was later replaced.
    const cafeteria = await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Comedor",
      sections: ["El comedor abre a la una."],
      replacedContent: "El comedor abría a mediodía.",
    });
    changedRoute = await seedPublishedRoute(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Ruta del comedor",
      source: {
        sourceId: cafeteria.sourceId,
        versionId: cafeteria.previousVersionId as string,
        title: "Comedor",
      },
      steps: [
        {
          title: "Horario del comedor",
          lesson: "El comedor abre a mediodía [1].",
          question: "¿Cuándo abre el comedor?",
          options: ["A mediodía", "Por la noche", "Nunca"],
          correct: 0,
          explanation: "Lo dice el horario.",
        },
      ],
    });

    // A lesson whose only source was deleted afterwards.
    const bikes = await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Aparcamiento",
      sections: ["Las bicicletas se aparcan en el sótano."],
    });
    deletedRoute = await seedPublishedRoute(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Ruta de bicicletas",
      source: { ...bikes, title: "Aparcamiento" },
      steps: [
        {
          title: "Bicicletas",
          lesson: "Las bicicletas se aparcan en el sótano [1].",
          question: "¿Dónde se aparcan las bicicletas?",
          options: ["En el sótano", "En la azotea", "En la calle"],
          correct: 0,
          explanation: "Lo dice la norma.",
        },
      ],
    });
    await connection.client`
      update public.sources
      set status = 'eliminada', deleted_at = now(), deleted_by = ${owner.id}
      where id = ${bikes.sourceId}
    `;

    for (const route of [routeId, changedRoute.routeId, deletedRoute.routeId]) {
      await startRoute(learningDependencies, {
        identityId: member.id,
        spaceId,
        routeId: route,
      });
    }
    await startRoute(learningDependencies, {
      identityId: revoked.id,
      spaceId,
      routeId,
    });
    await connection.client`
      update public.memberships set status = 'revocada'
      where space_id = ${spaceId} and profile_id = ${revoked.id}
    `;
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

  it("gives hints for an unresolved step without the answer key and without touching progress", async () => {
    await answerStep(learningDependencies, {
      identityId: member.id,
      spaceId,
      routeId,
      stepId: stepIds[0],
      selectedOption: 1,
      submissionId: randomUUID(),
    });
    const before = await progressSnapshot(member);
    calls.length = 0;

    const result = await help(member, {
      question: "Dime directamente cuál es la opción correcta",
    });

    expect(result).toMatchObject({
      kind: "answered",
      mode: "pistas",
      sourcesChanged: false,
    });
    expect(calls).toHaveLength(1);
    const [{ system, user }] = calls;
    expect(system).toContain(stepHintMarker);
    expect(system).not.toContain(stepExplanationMarker);
    expect(`${system}\n${user}`).not.toContain(secretExplanation);
    expect(user).not.toMatch(/Respuesta correcta|Respuestas de la persona/);
    expect(user).toContain("¿Qué exige un cambio incompatible en un contrato?");
    expect(user).toContain('if (incompatible) {\n  ruta = "/v2";\n}');
    // Step sources come first; another source of the space only fills in.
    if (result.kind !== "answered") throw new Error(result.kind);
    expect(result.fragments[0].sourceId).toBe(contractsSourceId);
    expect(result.fragments.map((fragment) => fragment.sourceTitle)).toContain(
      "Manual de despliegues",
    );
    expect(result.citations).toEqual([
      expect.objectContaining({ ref: 1, fromStepSources: true }),
    ]);

    expect(await progressSnapshot(member)).toEqual(before);
    expect(before.find((row) => row.route_id === routeId)).toMatchObject({
      attempts: 1,
    });
  });

  it("explains the answer once the step is resolved", async () => {
    await answerStep(learningDependencies, {
      identityId: member.id,
      spaceId,
      routeId,
      stepId: stepIds[0],
      selectedOption: 0,
      submissionId: randomUUID(),
    });
    const before = await progressSnapshot(member);
    calls.length = 0;

    const result = await help(member);

    expect(result).toMatchObject({ kind: "answered", mode: "explicacion" });
    expect(calls[0].system).toContain(stepExplanationMarker);
    expect(calls[0].user).toContain(secretExplanation);
    expect(calls[0].user).toContain("Respuesta correcta: A");
    expect(calls[0].user).toContain("Respuestas de la persona: B, A");
    expect(await progressSnapshot(member)).toEqual(before);
  });

  it("explains the step's own code citing it as “Código del paso” when no fragment covers it", async () => {
    // The step is resolved (previous test) and has illustrative code.
    const codeOnly = {
      estado: "respondida",
      respuesta:
        'Si el cambio es incompatible, el código asigna la ruta "/v2" [código].',
      citas: [],
    };
    calls.length = 0;
    nextReply = codeOnly;
    const result = await help(member, { question: "¿Qué hace el código?" });
    expect(result).toMatchObject({
      kind: "answered",
      mode: "explicacion",
      citesStepCode: true,
      citations: [],
    });
    expect(calls[0].system).toContain("cítalo como [código]");
    expect(calls[0].system).toContain("No lo uses para afirmar convenciones");
    expect(calls[0].user).toContain("Código del paso [código]");

    // Without any evidence the answer is still rejected (the reported case).
    nextReply = { ...codeOnly, respuesta: "El código asigna /v2." };
    expect(await help(member)).toMatchObject({ kind: "unverifiable" });
    // A step without code cannot use the marker as evidence.
    nextReply = codeOnly;
    expect(
      await help(member, {
        routeId: changedRoute.routeId,
        stepId: changedRoute.stepIds[0],
      }),
    ).toMatchObject({ kind: "unverifiable" });
  });

  it("refuses locked steps, other spaces, revoked members and invalid input before calling the model", async () => {
    calls.length = 0;
    expect(await help(owner)).toEqual({ kind: "not_started" });
    expect(await help(foreign)).toEqual({ kind: "unauthorized" });
    expect(await help(revoked)).toEqual({ kind: "unauthorized" });
    expect(await help(member, { routeId: changedRoute.routeId })).toEqual({
      kind: "not_found",
    });
    expect(await help(member, { stepId: randomUUID() })).toEqual({
      kind: "not_found",
    });
    expect(await help(member, { question: "ab" })).toEqual({
      kind: "invalid_question",
    });
    // Step 2 is current now; a fresh learner still has it locked.
    await startRoute(learningDependencies, {
      identityId: owner.id,
      spaceId,
      routeId,
    });
    expect(await help(owner, { stepId: stepIds[1] })).toEqual({
      kind: "locked",
    });
    expect(calls).toHaveLength(0);
  });

  it("warns about changed sources and only sends their current version", async () => {
    calls.length = 0;
    const result = await help(member, {
      routeId: changedRoute.routeId,
      stepId: changedRoute.stepIds[0],
    });
    expect(result).toMatchObject({
      kind: "answered",
      mode: "pistas",
      sourcesChanged: true,
    });
    expect(calls[0].user).toContain('fuentes_cambiaron="sí"');
    expect(calls[0].user).toContain("El comedor abre a la una.");
    expect(calls[0].user).not.toContain("El comedor abría a mediodía.");
  });

  it("says there is not enough evidence when the step's only source was deleted", async () => {
    calls.length = 0;
    const result = await help(member, {
      routeId: deletedRoute.routeId,
      stepId: deletedRoute.stepIds[0],
    });
    expect(result).toMatchObject({
      kind: "insufficient",
      sourcesChanged: true,
      fragments: [],
    });
    expect(calls).toHaveLength(0);
  });
});
