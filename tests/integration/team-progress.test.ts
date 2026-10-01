import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresLearningRepository } from "../../src/adapters/postgres/learning-repository.ts";
import { PostgresRouteRepository } from "../../src/adapters/postgres/route-repository.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import {
  answerStep,
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
const runKey = `e5-2-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let finisher: LocalTestIdentity;
let midway: LocalTestIdentity;
let idle: LocalTestIdentity;
let revoked: LocalTestIdentity;
let foreign: LocalTestIdentity;
let spaceId: string;
let routeId: string;
let draftRouteId: string;
let stepIds: string[];

async function addMember(identity: LocalTestIdentity) {
  await connection.client`
    insert into public.profiles (identity_id) values (${identity.id})
    on conflict (identity_id) do nothing
  `;
  await connection.client`
    insert into public.memberships (space_id, profile_id, role)
    values (${spaceId}, ${identity.id}, 'integrante')
  `;
}

async function play(identity: LocalTestIdentity, answers: [number, number][]) {
  await startRoute(dependencies, { identityId: identity.id, spaceId, routeId });
  for (const [stepIndex, option] of answers) {
    const result = await answerStep(dependencies, {
      identityId: identity.id,
      spaceId,
      routeId,
      stepId: stepIds[stepIndex],
      selectedOption: option,
      submissionId: randomUUID(),
    });
    if (result.kind !== "recorded") throw new Error(result.kind);
  }
}

const team = (identity: LocalTestIdentity, route = routeId) =>
  readTeamProgress(dependencies, {
    identityId: identity.id,
    spaceId,
    routeId: route,
  });

describe("E5.2 team progress for responsibles", () => {
  beforeAll(async () => {
    for (let index = 0; index < 6; index += 1) {
      identities.push(await createLocalTestIdentity(admin));
    }
    [owner, finisher, midway, idle, revoked, foreign] = identities;
    spaceId = (
      await bootstrapSpace(accessRepository, {
        email: owner.email,
        slug: `${runKey}-main`,
        name: "E5.2 main",
      })
    ).space.id;
    await bootstrapSpace(accessRepository, {
      email: foreign.email,
      slug: `${runKey}-foreign`,
      name: "E5.2 foreign",
    });
    for (const identity of [finisher, midway, idle, revoked]) {
      await addMember(identity);
    }
    const source = await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Guía",
      sections: ["Texto."],
    });
    const step = (n: number) => ({
      title: `Paso ${n}`,
      lesson: `Lección ${n} [1]`,
      question: `¿Pregunta ${n}?`,
      options: ["Correcta", "Incorrecta", "Otra"],
      correct: 0,
      explanation: "Explicación",
    });
    ({ routeId, stepIds } = await seedPublishedRoute(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Ruta E5.2",
      source: { ...source, title: "Guía" },
      steps: [step(1), step(2)],
    }));
    draftRouteId = (
      await seedPublishedRoute(connection.client, {
        spaceId,
        creatorId: owner.id,
        title: "Borrador",
        source: { ...source, title: "Guía" },
        steps: [step(1)],
      })
    ).routeId;
    await connection.client`
      update public.routes
      set status = 'borrador', published_at = null, published_by = null
      where id = ${draftRouteId}
    `;

    // Completed with 1 of 2 correct (step 2 exhausted); 4 submissions in all.
    await play(finisher, [
      [0, 1],
      [0, 0],
      [1, 1],
      [1, 2],
      [1, 1],
    ]);
    // In progress: step 1 resolved and correct.
    await play(midway, [[0, 0]]);
    // Progress of a revoked member is kept but hidden.
    await play(revoked, [[0, 0]]);
    await connection.client`
      update public.memberships set status = 'revocada'
      where space_id = ${spaceId} and profile_id = ${revoked.id}
    `;
    // Progress of another published version must not be mixed in.
    await connection.client`
      insert into public.route_progress
        (route_id, space_id, profile_id, route_published_at, started_at)
      values (${routeId}, ${spaceId}, ${idle.id}, now() - interval '30 days',
        now() - interval '30 days')
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

  it("reports accurate totals for active members of the published version", async () => {
    const progress = await team(owner);
    expect(progress).toMatchObject({
      totalSteps: 2,
      activeMembers: 4,
      started: 2,
      completed: 1,
    });
    const expectedOrder = [owner, finisher, midway, idle]
      .map((identity) => identity.email.toLowerCase())
      .sort();
    expect(progress?.members.map((member) => member.email)).toEqual(
      expectedOrder,
    );
    const byId = new Map(
      progress?.members.map((member) => [member.profileId, member]),
    );
    expect(byId.get(finisher.id)).toMatchObject({
      state: "completada",
      resolvedSteps: 2,
      correctSteps: 1,
    });
    expect(byId.get(finisher.id)?.completedAt).not.toBeNull();
    expect(byId.get(midway.id)).toMatchObject({
      state: "en_progreso",
      resolvedSteps: 1,
      correctSteps: 1,
      completedAt: null,
    });
    for (const quiet of [owner, idle]) {
      expect(byId.get(quiet.id)).toMatchObject({
        state: "no_empezada",
        resolvedSteps: 0,
        correctSteps: 0,
        startedAt: null,
      });
    }
    expect(byId.has(revoked.id)).toBe(false);
  });

  it("is only available to active responsibles of the space and for published routes", async () => {
    expect(await team(finisher)).toBeNull();
    expect(await team(foreign)).toBeNull();
    expect(await team(owner, draftRouteId)).toBeNull();
  });
});
