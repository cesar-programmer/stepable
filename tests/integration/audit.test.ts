import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresInvitationRepository } from "../../src/adapters/postgres/invitation-repository.ts";
import { PostgresMembershipRepository } from "../../src/adapters/postgres/membership-repository.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import { hashInvitationToken } from "../../src/modules/invitations/token.ts";
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
const invitationRepository = new PostgresInvitationRepository(
  connection.database,
);
const membershipRepository = new PostgresMembershipRepository(
  connection.database,
);
const runKey = `e1-7-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let leavingMember: LocalTestIdentity;
let cancelledInvitee: LocalTestIdentity;
let acceptedInvitee: LocalTestIdentity;
let spaceId: string;

async function addMember(identity: LocalTestIdentity) {
  await connection.client`
    insert into public.profiles (identity_id)
    values (${identity.id})
    on conflict (identity_id) do nothing
  `;
  await connection.client`
    insert into public.memberships (space_id, profile_id, role)
    values (${spaceId}, ${identity.id}, 'integrante')
  `;
}

function invitationInput(
  identity: LocalTestIdentity,
  token: string,
  now = new Date(),
) {
  return {
    spaceId,
    email: identity.email,
    role: "integrante" as const,
    invitedBy: owner.id,
    tokenHash: hashInvitationToken(token),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    now,
  };
}

describe("access audit", () => {
  beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );
    [owner, member, leavingMember, cancelledInvitee, acceptedInvitee] =
      identities;
    spaceId = (
      await bootstrapSpace(accessRepository, {
        email: owner.email,
        slug: `${runKey}-space`,
        name: "E1.7 audit space",
      })
    ).space.id;
    await addMember(member);
    await addMember(leavingMember);
  });

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

  it("records only successful access mutations with identifiers and no personal fields", async () => {
    const bootstrapInput = {
      email: owner.email,
      slug: `${runKey}-space`,
      name: "E1.7 audit space",
    };
    await expect(
      bootstrapSpace(accessRepository, bootstrapInput),
    ).resolves.toMatchObject({ created: false });

    await expect(
      membershipRepository.changeMemberRole({
        actorIdentityId: owner.id,
        spaceId,
        targetProfileId: member.id,
        role: "responsable",
      }),
    ).resolves.toEqual({ kind: "updated" });
    await expect(
      membershipRepository.revokeMember({
        actorIdentityId: owner.id,
        spaceId,
        targetProfileId: member.id,
      }),
    ).resolves.toEqual({ kind: "revoked" });
    await expect(
      membershipRepository.leaveSpace({
        actorIdentityId: leavingMember.id,
        spaceId,
      }),
    ).resolves.toEqual({ kind: "left" });
    await expect(
      membershipRepository.leaveSpace({
        actorIdentityId: owner.id,
        spaceId,
      }),
    ).resolves.toEqual({ kind: "last_responsible" });

    const cancelled = await invitationRepository.createInvitation(
      invitationInput(cancelledInvitee, "a".repeat(43)),
    );
    expect(cancelled.kind).toBe("created");
    if (cancelled.kind !== "created") throw new Error("fixture not created");

    await expect(
      invitationRepository.prepareResend({
        actorIdentityId: owner.id,
        invitationId: cancelled.invitation.id,
        spaceId,
        tokenHash: hashInvitationToken("b".repeat(43)),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        now: new Date(),
      }),
    ).resolves.toMatchObject({ kind: "prepared" });
    await expect(
      invitationRepository.cancelInvitation({
        actorIdentityId: owner.id,
        invitationId: cancelled.invitation.id,
        spaceId,
        now: new Date(),
      }),
    ).resolves.toEqual({ kind: "cancelled" });

    const acceptedToken = "c".repeat(43);
    const accepted = await invitationRepository.createInvitation(
      invitationInput(acceptedInvitee, acceptedToken),
    );
    expect(accepted.kind).toBe("created");
    await expect(
      invitationRepository.acceptInvitation({
        tokenHash: hashInvitationToken(acceptedToken),
        identityId: acceptedInvitee.id,
        identityEmail: acceptedInvitee.email,
        now: new Date(),
      }),
    ).resolves.toEqual({ kind: "joined", spaceId });

    await expect(
      invitationRepository.createInvitation({
        ...invitationInput(cancelledInvitee, "d".repeat(43)),
        invitedBy: leavingMember.id,
      }),
    ).resolves.toEqual({ kind: "unauthorized" });

    const rows = await connection.client`
      select
        action::text,
        actor_type::text,
        actor_profile_id,
        space_id,
        target_type::text,
        target_id,
        occurred_at
      from public.access_audit_events
      where space_id = ${spaceId}
    `;
    expect(rows).toHaveLength(9);
    expect(rows.map((row) => row.action).sort()).toEqual(
      [
        "espacio_creado",
        "invitacion_aceptada",
        "invitacion_cancelada",
        "invitacion_creada",
        "invitacion_creada",
        "invitacion_reenviada",
        "membresia_abandonada",
        "membresia_retirada",
        "rol_membresia_cambiado",
      ].sort(),
    );
    expect(rows.find((row) => row.action === "espacio_creado")).toMatchObject({
      actor_type: "operador",
      actor_profile_id: null,
      space_id: spaceId,
      target_type: "espacio",
      target_id: spaceId,
    });
    expect(
      rows
        .filter((row) => row.actor_type === "identidad")
        .every((row) => row.actor_profile_id && row.occurred_at),
    ).toBe(true);

    const columns = await connection.client`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'access_audit_events'
      order by ordinal_position
    `;
    expect(columns.map((column) => column.column_name)).toEqual([
      "id",
      "action",
      "actor_type",
      "actor_profile_id",
      "space_id",
      "target_type",
      "target_id",
      "occurred_at",
    ]);
  });

  it("keeps every E1 business table closed to Supabase Data API roles", async () => {
    const access = await connection.client`
      select
        c.relname as table_name,
        c.relrowsecurity as row_security,
        has_table_privilege('anon', c.oid, 'select,insert,update,delete') as anon_access,
        has_table_privilege('authenticated', c.oid, 'select,insert,update,delete') as authenticated_access
      from pg_class c
      inner join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'profiles',
          'spaces',
          'memberships',
          'invitations',
          'access_audit_events'
        )
      order by c.relname
    `;

    expect(access).toHaveLength(5);
    expect(
      access.every(
        (table) =>
          table.row_security &&
          !table.anon_access &&
          !table.authenticated_access,
      ),
    ).toBe(true);
  });
});
