import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresInvitationRepository } from "../../src/adapters/postgres/invitation-repository.ts";
import type { InvitationMailer } from "../../src/modules/invitations/contract.ts";
import {
  acceptSpaceInvitation,
  cancelSpaceInvitation,
  inspectSpaceInvitation,
  issueSpaceInvitation,
  resendSpaceInvitation,
} from "../../src/modules/invitations/service.ts";
import { hashInvitationToken } from "../../src/modules/invitations/token.ts";
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
const invitationRepository = new PostgresInvitationRepository(
  connection.database,
);
const runKey = `e1-5-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
const delivered: string[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let outsider: LocalTestIdentity;
let spaceId: string;

const mailer: InvitationMailer = {
  async sendInvitation(input) {
    delivered.push(input.acceptUrl);
  },
};

const dependencies = {
  accessRepository,
  invitationRepository,
  mailer,
  applicationUrl: "http://127.0.0.1:3000",
};

async function addProfile(identity: LocalTestIdentity) {
  await connection.client`
    insert into public.profiles (identity_id)
    values (${identity.id})
    on conflict (identity_id) do nothing
  `;
}

async function issue(
  identity: LocalTestIdentity,
  recipient: LocalTestIdentity,
  token: string,
  role: "responsable" | "integrante" = "integrante",
  now = new Date(),
) {
  return issueSpaceInvitation(dependencies, {
    identityId: identity.id,
    spaceId,
    email: recipient.email,
    role,
    token,
    now,
  });
}

describe("space invitations", () => {
  beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );
    [owner, member, outsider] = identities;
    spaceId = (
      await bootstrapSpace(accessRepository, {
        email: owner.email,
        slug: `${runKey}-space`,
        name: "E1.5 invitation space",
      })
    ).space.id;
    await addProfile(member);
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${spaceId}, ${member.id}, 'integrante')
    `;
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

  it("allows only active responsibles and prevents multiple usable pending invitations", async () => {
    const target = identities[3];
    expect(await issue(member, target, "a".repeat(43))).toBe("unauthorized");
    expect(await issue(owner, target, "b".repeat(43))).toBe("sent");
    expect(await issue(owner, target, "c".repeat(43))).toBe("pending_exists");

    await expect(
      connection.client`
        insert into public.invitations (
          space_id, email, role, invited_by, token_hash, expires_at
        ) values (
          ${spaceId}, ${target.email}, 'integrante', ${owner.id},
          ${hashInvitationToken("d".repeat(43))}, now() + interval '7 days'
        )
      `,
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("reports delivery failure, allows recovery by resend, and isolates space identifiers", async () => {
    const target = await createLocalTestIdentity(admin);
    identities.push(target);
    const failingDependencies = {
      ...dependencies,
      mailer: {
        async sendInvitation() {
          throw new Error("simulated local delivery failure");
        },
      } satisfies InvitationMailer,
    };
    expect(
      await issueSpaceInvitation(failingDependencies, {
        identityId: owner.id,
        spaceId,
        email: target.email,
        role: "integrante",
        token: "m".repeat(43),
      }),
    ).toBe("delivery_failed");
    const [row] = await connection.client`
      select id, delivery_status::text
      from public.invitations
      where space_id = ${spaceId} and email = ${target.email}
    `;
    expect(row.delivery_status).toBe("fallida");
    expect(
      await resendSpaceInvitation(dependencies, {
        identityId: owner.id,
        spaceId,
        invitationId: row.id,
        token: "n".repeat(43),
      }),
    ).toBe("sent");

    const foreign = await bootstrapSpace(accessRepository, {
      email: outsider.email,
      slug: `${runKey}-foreign`,
      name: "Foreign invitation space",
    });
    expect(
      await resendSpaceInvitation(dependencies, {
        identityId: owner.id,
        spaceId: foreign.space.id,
        invitationId: row.id,
        token: "o".repeat(43),
      }),
    ).toBe("unauthorized");
  });

  it("accepts verified matching identities for either role and is idempotent", async () => {
    const target = identities[4];
    const token = "e".repeat(43);
    expect(await issue(owner, target, token, "responsable")).toBe("sent");
    expect(
      await inspectSpaceInvitation(invitationRepository, token),
    ).toMatchObject({
      role: "responsable",
      status: "pendiente",
    });

    expect(
      await acceptSpaceInvitation(invitationRepository, {
        token,
        identityId: outsider.id,
        identityEmail: outsider.email,
        emailVerified: true,
      }),
    ).toEqual({ kind: "email_mismatch" });
    expect(
      await acceptSpaceInvitation(invitationRepository, {
        token,
        identityId: target.id,
        identityEmail: target.email,
        emailVerified: true,
      }),
    ).toEqual({ kind: "joined", spaceId });
    expect(
      await acceptSpaceInvitation(invitationRepository, {
        token,
        identityId: target.id,
        identityEmail: target.email,
        emailVerified: true,
      }),
    ).toEqual({ kind: "already_accepted", spaceId });

    await connection.client`
      update public.memberships set status = 'revocada'
      where space_id = ${spaceId} and profile_id = ${target.id}
    `;
    expect(
      await acceptSpaceInvitation(invitationRepository, {
        token,
        identityId: target.id,
        identityEmail: target.email,
        emailVerified: true,
      }),
    ).toEqual({ kind: "already_accepted", spaceId });
    const [membership] = await connection.client`
      select role::text, status::text from public.memberships
      where space_id = ${spaceId} and profile_id = ${target.id}
    `;
    expect(membership).toEqual({ role: "responsable", status: "revocada" });
  });

  it("rotates on resend, cancels, expires, and rejects old or invalid tokens", async () => {
    const target = identities[5];
    const oldToken = "f".repeat(43);
    const newToken = "g".repeat(43);
    expect(await issue(owner, target, oldToken)).toBe("sent");
    const [row] = await connection.client`
      select id from public.invitations
      where space_id = ${spaceId} and email = ${target.email}
    `;
    expect(
      await resendSpaceInvitation(dependencies, {
        identityId: owner.id,
        spaceId,
        invitationId: row.id,
        token: newToken,
      }),
    ).toBe("sent");
    expect(
      await inspectSpaceInvitation(invitationRepository, oldToken),
    ).toBeNull();
    expect(
      await inspectSpaceInvitation(invitationRepository, newToken),
    ).toMatchObject({
      status: "pendiente",
    });
    expect(
      await cancelSpaceInvitation(dependencies, {
        identityId: owner.id,
        spaceId,
        invitationId: row.id,
      }),
    ).toEqual({ kind: "cancelled" });
    expect(
      await inspectSpaceInvitation(invitationRepository, newToken),
    ).toMatchObject({
      status: "revocada",
    });

    const expiringTarget = identities[6];
    const expiringToken = "h".repeat(43);
    const issuedAt = new Date("2030-01-01T00:00:00.000Z");
    expect(
      await issue(owner, expiringTarget, expiringToken, "integrante", issuedAt),
    ).toBe("sent");
    expect(
      await inspectSpaceInvitation(
        invitationRepository,
        expiringToken,
        new Date("2030-01-08T00:00:00.001Z"),
      ),
    ).toMatchObject({ status: "vencida" });
    expect(
      await inspectSpaceInvitation(invitationRepository, "z".repeat(43)),
    ).toBeNull();
  });

  it("reactivates revoked memberships but never changes an active role", async () => {
    const target = identities[7];
    await addProfile(target);
    await connection.client`
      insert into public.memberships (space_id, profile_id, role, status)
      values (${spaceId}, ${target.id}, 'responsable', 'revocada')
    `;
    const token = "i".repeat(43);
    expect(await issue(owner, target, token, "integrante")).toBe("sent");
    expect(
      await acceptSpaceInvitation(invitationRepository, {
        token,
        identityId: target.id,
        identityEmail: target.email,
        emailVerified: true,
      }),
    ).toEqual({ kind: "reactivated", spaceId });

    expect(await issue(owner, target, "j".repeat(43), "integrante")).toBe(
      "already_member",
    );
    expect(await issue(owner, target, "k".repeat(43), "responsable")).toBe(
      "member_role_conflict",
    );
    const [membership] = await connection.client`
      select role::text, status::text from public.memberships
      where space_id = ${spaceId} and profile_id = ${target.id}
    `;
    expect(membership).toEqual({ role: "integrante", status: "activa" });
  });

  it("keeps acceptance atomic against concurrent resend and cancel", async () => {
    const target = await createLocalTestIdentity(admin);
    identities.push(target);
    const token = "l".repeat(43);
    expect(await issue(owner, target, token)).toBe("sent");
    const [row] = await connection.client`
      select id from public.invitations
      where space_id = ${spaceId} and email = ${target.email}
    `;

    const [acceptance, cancellation] = await Promise.all([
      acceptSpaceInvitation(invitationRepository, {
        token,
        identityId: target.id,
        identityEmail: target.email,
        emailVerified: true,
      }),
      cancelSpaceInvitation(dependencies, {
        identityId: owner.id,
        spaceId,
        invitationId: row.id,
      }),
    ]);
    expect(
      (acceptance.kind === "joined" &&
        cancellation.kind === "not_cancellable") ||
        (acceptance.kind === "cancelled" && cancellation.kind === "cancelled"),
    ).toBe(true);

    const [state] = await connection.client`
      select i.status::text as invitation_status, m.status::text as membership_status
      from public.invitations i
      left join public.memberships m
        on m.space_id = i.space_id and m.profile_id = ${target.id}
      where i.id = ${row.id}
    `;
    expect(
      state.invitation_status === "aceptada"
        ? state.membership_status === "activa"
        : state.membership_status === null,
    ).toBe(true);
  });

  it("keeps acceptance coherent against a concurrent resend", async () => {
    const target = await createLocalTestIdentity(admin);
    identities.push(target);
    const token = "p".repeat(43);
    const rotatedToken = "q".repeat(43);
    expect(await issue(owner, target, token)).toBe("sent");
    const [row] = await connection.client`
      select id from public.invitations
      where space_id = ${spaceId} and email = ${target.email}
    `;

    const [acceptance, resend] = await Promise.all([
      acceptSpaceInvitation(invitationRepository, {
        token,
        identityId: target.id,
        identityEmail: target.email,
        emailVerified: true,
      }),
      resendSpaceInvitation(dependencies, {
        identityId: owner.id,
        spaceId,
        invitationId: row.id,
        token: rotatedToken,
      }),
    ]);
    expect(
      (acceptance.kind === "joined" && resend === "not_resendable") ||
        (acceptance.kind === "invalid" && resend === "sent"),
    ).toBe(true);
    const [state] = await connection.client`
      select i.status::text as invitation_status, m.status::text as membership_status
      from public.invitations i
      left join public.memberships m
        on m.space_id = i.space_id and m.profile_id = ${target.id}
      where i.id = ${row.id}
    `;
    expect(
      state.invitation_status === "aceptada"
        ? state.membership_status === "activa"
        : state.invitation_status === "pendiente" &&
            state.membership_status === null,
    ).toBe(true);
  });
});
