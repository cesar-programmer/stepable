import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresMembershipRepository } from "../../src/adapters/postgres/membership-repository.ts";
import { authorizeSpaceAction } from "../../src/modules/access/authorization.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import {
  createAdminClient,
  createLocalTestIdentity,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
} from "../support/local-auth.ts";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const accessRepository = new PostgresAccessRepository(connection.database);
const repository = new PostgresMembershipRepository(connection.database);
const runKey = `e1-6-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];

async function identity() {
  const created = await createLocalTestIdentity(admin);
  identities.push(created);
  return created;
}

async function ensureProfile(person: LocalTestIdentity) {
  await connection.client`
    insert into public.profiles (identity_id)
    values (${person.id})
    on conflict (identity_id) do nothing
  `;
}

async function createSpace(owner: LocalTestIdentity, suffix: string) {
  return (
    await bootstrapSpace(accessRepository, {
      email: owner.email,
      slug: `${runKey}-${suffix}`,
      name: `E1.6 ${suffix}`,
    })
  ).space;
}

async function addMember(
  spaceId: string,
  person: LocalTestIdentity,
  role: "responsable" | "integrante" = "integrante",
  status: "activa" | "revocada" = "activa",
) {
  await ensureProfile(person);
  await connection.client`
    insert into public.memberships (space_id, profile_id, role, status)
    values (${spaceId}, ${person.id}, ${role}, ${status})
  `;
}

describe("membership administration", () => {
  beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );
  });

  afterAll(async () => {
    await connection.client`
      delete from public.spaces where slug like ${`${runKey}%`}
    `;
    for (const person of identities) {
      await connection.client`
        delete from public.profiles where identity_id = ${person.id}
      `;
      await deleteLocalTestIdentity(admin, person.id);
    }
    await connection.close();
  });

  it("lists active and revoked memberships only for an active responsible", async () => {
    const [owner, member, revoked] = identities;
    const foreignOwner = await identity();
    const space = await createSpace(owner, "list");
    const foreign = await createSpace(foreignOwner, "foreign-list");
    await addMember(space.id, member);
    await addMember(space.id, revoked, "responsable", "revocada");

    const rows = await repository.listMembersForManager(owner.id, space.id);
    expect(rows).toHaveLength(3);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileId: member.id,
          role: "integrante",
          status: "activa",
        }),
        expect.objectContaining({
          profileId: revoked.id,
          role: "responsable",
          status: "revocada",
        }),
      ]),
    );
    expect(rows?.some((row) => row.profileId === foreignOwner.id)).toBe(false);
    expect(
      await repository.listMembersForManager(member.id, space.id),
    ).toBeNull();
    expect(
      await repository.listMembersForManager(owner.id, foreign.id),
    ).toBeNull();
  });

  it("promotes, demotes and revokes active members but never mutates a revoked membership", async () => {
    const [owner, member, revoked] = identities;
    const space = await createSpace(owner, "mutations");
    await addMember(space.id, member);
    await addMember(space.id, revoked, "integrante", "revocada");

    await expect(
      repository.changeMemberRole({
        actorIdentityId: owner.id,
        spaceId: space.id,
        targetProfileId: member.id,
        role: "responsable",
      }),
    ).resolves.toEqual({ kind: "updated" });
    await expect(
      repository.changeMemberRole({
        actorIdentityId: owner.id,
        spaceId: space.id,
        targetProfileId: member.id,
        role: "integrante",
      }),
    ).resolves.toEqual({ kind: "updated" });
    await expect(
      repository.revokeMember({
        actorIdentityId: owner.id,
        spaceId: space.id,
        targetProfileId: member.id,
      }),
    ).resolves.toEqual({ kind: "revoked" });
    await expect(
      repository.changeMemberRole({
        actorIdentityId: owner.id,
        spaceId: space.id,
        targetProfileId: member.id,
        role: "responsable",
      }),
    ).resolves.toEqual({ kind: "inactive" });
    await expect(
      repository.revokeMember({
        actorIdentityId: owner.id,
        spaceId: space.id,
        targetProfileId: revoked.id,
      }),
    ).resolves.toEqual({ kind: "inactive" });
  });

  it("denies members, foreign actors and identifiers from another space", async () => {
    const [owner, member] = identities;
    const foreignOwner = await identity();
    const foreignMember = await identity();
    const space = await createSpace(owner, "isolation");
    const foreign = await createSpace(foreignOwner, "foreign-isolation");
    await addMember(space.id, member);
    await addMember(foreign.id, foreignMember);

    await expect(
      repository.changeMemberRole({
        actorIdentityId: member.id,
        spaceId: space.id,
        targetProfileId: member.id,
        role: "responsable",
      }),
    ).resolves.toEqual({ kind: "unauthorized" });
    await expect(
      repository.revokeMember({
        actorIdentityId: foreignOwner.id,
        spaceId: space.id,
        targetProfileId: member.id,
      }),
    ).resolves.toEqual({ kind: "unauthorized" });
    await expect(
      repository.revokeMember({
        actorIdentityId: owner.id,
        spaceId: space.id,
        targetProfileId: foreignMember.id,
      }),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("allows self-demotion and leaving while preserving another active responsible", async () => {
    const [owner, member] = identities;
    const backup = await identity();
    const retained = await createSpace(owner, "retained");
    const space = await createSpace(owner, "self-service");
    await addMember(space.id, backup, "responsable");
    await addMember(space.id, member);

    await expect(
      repository.changeMemberRole({
        actorIdentityId: owner.id,
        spaceId: space.id,
        targetProfileId: owner.id,
        role: "integrante",
      }),
    ).resolves.toEqual({ kind: "updated" });
    expect(
      await repository.listMembersForManager(owner.id, space.id),
    ).toBeNull();
    await expect(
      repository.leaveSpace({
        actorIdentityId: member.id,
        spaceId: space.id,
      }),
    ).resolves.toEqual({ kind: "left" });
    expect(
      await authorizeSpaceAction(
        accessRepository,
        member.id,
        space.id,
        "consultar_espacio",
      ),
    ).toBeNull();
    expect(
      await authorizeSpaceAction(
        accessRepository,
        owner.id,
        retained.id,
        "consultar_espacio",
      ),
    ).not.toBeNull();
  });

  it("rejects demotion, revocation and self-exit of the last active responsible", async () => {
    const owner = await identity();
    const space = await createSpace(owner, "last-responsible");

    await expect(
      repository.changeMemberRole({
        actorIdentityId: owner.id,
        spaceId: space.id,
        targetProfileId: owner.id,
        role: "integrante",
      }),
    ).resolves.toEqual({ kind: "last_responsible" });
    await expect(
      repository.revokeMember({
        actorIdentityId: owner.id,
        spaceId: space.id,
        targetProfileId: owner.id,
      }),
    ).resolves.toEqual({ kind: "last_responsible" });
    await expect(
      repository.leaveSpace({
        actorIdentityId: owner.id,
        spaceId: space.id,
      }),
    ).resolves.toEqual({ kind: "last_responsible" });
  });

  it("serializes concurrent responsible operations and revalidates the actor", async () => {
    const first = await identity();
    const second = await identity();
    const space = await createSpace(first, "concurrent");
    await addMember(space.id, second, "responsable");

    const results = await Promise.all([
      repository.revokeMember({
        actorIdentityId: first.id,
        spaceId: space.id,
        targetProfileId: second.id,
      }),
      repository.changeMemberRole({
        actorIdentityId: second.id,
        spaceId: space.id,
        targetProfileId: first.id,
        role: "integrante",
      }),
    ]);

    expect(
      results.filter((result) => result.kind === "unauthorized"),
    ).toHaveLength(1);
    expect(
      results.filter(
        (result) => result.kind === "revoked" || result.kind === "updated",
      ),
    ).toHaveLength(1);
    const [counts] = await connection.client`
      select
        count(*) filter (
          where role = 'responsable' and status = 'activa'
        )::int as active_responsibles
      from public.memberships
      where space_id = ${space.id}
    `;
    expect(counts.active_responsibles).toBe(1);
  });
});
