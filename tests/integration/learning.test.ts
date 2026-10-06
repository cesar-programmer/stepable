import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresLearningRepository } from "../../src/adapters/postgres/learning-repository.ts";
import { PostgresRouteRepository } from "../../src/adapters/postgres/route-repository.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import {
  answerStep,
  readLearnerView,
  readTeamProgress,
  startRoute,
} from "../../src/modules/learning/service.ts";
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
const dependencies = {
  accessRepository,
  routeRepository: new PostgresRouteRepository(connection.database, null),
  learningRepository: new PostgresLearningRepository(connection.database),
};
const runKey = `e5-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let foreignOwner: LocalTestIdentity;
let spaceId: string;
let sourceId: string;
let routeId: string;
let stepIds: string[];

const step = (n: number) => ({
  title: `Paso ${n}`,
  lesson: `Lección ${n} [1]`,
  question: `¿Pregunta ${n}?`,
  options: ["Correcta", "Incorrecta", "Otra"],
  correct: 0,
  explanation: `Explicación ${n}`,
});

const answer = (
  stepId: string,
  selectedOption: number,
  identity = member,
  submissionId = randomUUID(),
) =>
  answerStep(dependencies, {
    identityId: identity.id,
    spaceId,
    routeId,
    stepId,
    selectedOption,
    submissionId,
  });

const view = (identity = member) =>
  readLearnerView(dependencies, {
    identityId: identity.id,
    spaceId,
    routeId,
  });

describe("E5.1 learner progress on published routes", () => {
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
        name: "E5 main",
      })
    ).space.id;
    await bootstrapSpace(accessRepository, {
      email: foreignOwner.email,
      slug: `${runKey}-foreign`,
      name: "E5 foreign",
    });
    await connection.client`
      insert into public.profiles (identity_id) values (${member.id})
      on conflict (identity_id) do nothing
    `;
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${spaceId}, ${member.id}, 'integrante')
    `;
    const source = await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Guía",
      sections: ["Texto de la guía."],
    });
    sourceId = source.sourceId;
    ({ routeId, stepIds } = await seedPublishedRoute(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Ruta E5",
      source: { ...source, title: "Guía" },
      steps: [step(1), step(2), step(3)],
    }));
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

  it("starts a published route once and keeps the answer key hidden until resolved", async () => {
    await expect(answer(stepIds[0], 0)).resolves.toEqual({
      kind: "not_started",
    });
    const start = () =>
      startRoute(dependencies, { identityId: member.id, spaceId, routeId });
    await expect(start()).resolves.toEqual({ kind: "started" });
    await expect(start()).resolves.toEqual({ kind: "already_started" });
    await expect(
      startRoute(dependencies, {
        identityId: foreignOwner.id,
        spaceId,
        routeId,
      }),
    ).resolves.toEqual({ kind: "unauthorized" });

    const initial = await view();
    expect(initial?.steps.map((item) => item.state)).toEqual([
      "actual",
      "bloqueado",
      "bloqueado",
    ]);
    expect(initial?.steps[0]).toMatchObject({
      lesson: "Lección 1 [1]",
      correctOption: null,
      explanation: null,
    });
    expect(initial?.steps[1]).toMatchObject({ lesson: null, options: null });
  });

  it("grades on the server, keeps order and ignores a repeated submission", async () => {
    await expect(answer(stepIds[1], 0)).resolves.toEqual({
      kind: "not_current",
    });
    const submissionId = randomUUID();
    const [first, second] = await Promise.all([
      answer(stepIds[0], 1, member, submissionId),
      answer(stepIds[0], 1, member, submissionId),
    ]);
    expect([first, second]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          correct: false,
          attemptsLeft: 2,
          repeated: false,
        }),
        expect.objectContaining({
          correct: false,
          attemptsLeft: 2,
          repeated: true,
        }),
      ]),
    );
    const after = await view();
    expect(after?.steps[0]).toMatchObject({
      state: "actual",
      attemptsUsed: 1,
      correctOption: null,
    });
  });

  it("resolves a step after three misses, then counts correct steps not submissions", async () => {
    await answer(stepIds[0], 2);
    await expect(answer(stepIds[0], 1)).resolves.toMatchObject({
      kind: "recorded",
      correct: false,
      resolved: true,
      attemptsLeft: 0,
    });
    await expect(answer(stepIds[0], 0)).resolves.toEqual({
      kind: "already_resolved",
    });
    const exhausted = await view();
    expect(exhausted?.steps[0]).toMatchObject({
      state: "resuelto_sin_acertar",
      correctOption: 0,
      explanation: "Explicación 1",
    });

    await answer(stepIds[1], 2);
    await expect(answer(stepIds[1], 0)).resolves.toMatchObject({
      correct: true,
      resolved: true,
      completed: false,
    });
    // A cited source changes: the route is flagged but can be continued.
    await connection.client`
      update public.sources
      set status = 'eliminada', deleted_at = now(), deleted_by = ${owner.id}
      where id = ${sourceId}
    `;
    expect((await view())?.needsReview).toBe(true);
    await expect(answer(stepIds[2], 0)).resolves.toMatchObject({
      correct: true,
      completed: true,
    });

    // Returning later shows the same stored progress.
    const finished = await view();
    expect(finished).toMatchObject({
      completed: true,
      resolvedSteps: 3,
      correctSteps: 2,
      totalSteps: 3,
    });
    expect(finished?.steps.map((item) => item.state)).toEqual([
      "resuelto_sin_acertar",
      "acertado",
      "acertado",
    ]);
    const [progress] = await connection.client`
      select completed_at from public.route_progress
      where route_id = ${routeId} and profile_id = ${member.id}
    `;
    expect(progress.completed_at).not.toBeNull();
  });

  it("grades a fill-in step by exact text, alongside multiple choice", async () => {
    const source = await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Servicios",
      sections: ["Toda llamada HTTP usa httpClient."],
    });
    const mixed = await seedPublishedRoute(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Ruta mixta",
      source: { ...source, title: "Servicios" },
      steps: [
        step(1),
        {
          title: "Completar llamada",
          lesson: "Las llamadas usan el cliente compartido [1].",
          question: "Completa la llamada.",
          code: {
            content: "const r = await [[hueco]](`/v2/users/${id}`);",
            language: "ts",
            origin: "ilustrativo",
          },
          options: [],
          correct: null,
          explanation: "Se usa el cliente compartido.",
          activityType: "completar",
          acceptedAnswers: ["httpClient.get", "this.httpClient.get"],
        },
      ],
    });
    const ids = { identityId: owner.id, spaceId, routeId: mixed.routeId };
    const respond = (
      input: { selectedOption?: number; answerText?: string },
      stepId = mixed.stepIds[1],
      submissionId: string = randomUUID(),
    ) => answerStep(dependencies, { ...ids, stepId, submissionId, ...input });
    await startRoute(dependencies, ids);
    await expect(
      respond({ selectedOption: 0 }, mixed.stepIds[0]),
    ).resolves.toMatchObject({
      correct: true,
    });

    let fillIn = (await readLearnerView(dependencies, ids))?.steps[1];
    expect(fillIn).toMatchObject({
      activityType: "completar",
      state: "actual",
      options: [],
      acceptedAnswers: null,
      explanation: null,
    });
    expect(fillIn?.code?.content).toContain("[[hueco]]");

    // The response must match the activity; nothing is recorded otherwise.
    await expect(respond({ selectedOption: 0 })).resolves.toEqual({
      kind: "invalid",
    });
    await expect(respond({ answerText: "   " })).resolves.toEqual({
      kind: "invalid",
    });
    await expect(
      respond({ answerText: "x" }, mixed.stepIds[0]),
    ).resolves.toEqual({ kind: "invalid" });
    // Case, inner spaces and punctuation count.
    const wrong = randomUUID();
    await expect(
      respond({ answerText: "HttpClient.get" }, undefined, wrong),
    ).resolves.toMatchObject({
      correct: false,
      attemptsLeft: 2,
    });
    await expect(
      respond({ answerText: "HttpClient.get" }, undefined, wrong),
    ).resolves.toMatchObject({
      repeated: true,
      attemptsLeft: 2,
    });
    await expect(
      respond({ answerText: "httpClient .get" }),
    ).resolves.toMatchObject({
      correct: false,
      attemptsLeft: 1,
    });
    // A variant is accepted; only the ends are trimmed.
    await expect(
      respond({ answerText: "  this.httpClient.get " }),
    ).resolves.toMatchObject({
      correct: true,
      resolved: true,
      completed: true,
    });

    const finished = await readLearnerView(dependencies, ids);
    fillIn = finished?.steps[1];
    expect(fillIn).toMatchObject({
      state: "acertado",
      attemptsUsed: 3,
      acceptedAnswers: ["httpClient.get", "this.httpClient.get"],
      explanation: "Se usa el cliente compartido.",
      writtenAnswers: [
        "HttpClient.get",
        "httpClient .get",
        "this.httpClient.get",
      ],
    });
    expect(finished).toMatchObject({ completed: true, correctSteps: 2 });

    const team = await readTeamProgress(dependencies, ids);
    expect(
      team?.members.find((item) => item.profileId === owner.id),
    ).toMatchObject({ state: "completada", resolvedSteps: 2, correctSteps: 2 });
  });

  it("keeps progress private per user and revalidates membership", async () => {
    const ownerView = await view(owner);
    expect(ownerView).toMatchObject({
      started: false,
      resolvedSteps: 0,
      correctSteps: 0,
    });
    expect(ownerView?.steps.every((item) => item.correctOption === null)).toBe(
      true,
    );
    expect(await view(foreignOwner)).toBeNull();

    await connection.client`
      update public.memberships set status = 'revocada'
      where space_id = ${spaceId} and profile_id = ${member.id}
    `;
    expect(await view()).toBeNull();
    await expect(answer(stepIds[2], 0)).resolves.toEqual({
      kind: "unauthorized",
    });
  });
});
