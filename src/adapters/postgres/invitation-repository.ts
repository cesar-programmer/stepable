import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";

import { allowsSpaceAction } from "../../modules/access/authorization.ts";
import type {
  AcceptInvitationResult,
  AccountSetupTarget,
  CancelInvitationResult,
  CreateInvitationInput,
  CreateInvitationResult,
  InvitationPreview,
  InvitationRepository,
  InvitationStatus,
  PrepareResendResult,
  SpaceInvitation,
} from "../../modules/invitations/contract.ts";

import { recordAccessAuditEvent } from "./access-audit.ts";
import type { StepableDatabase } from "./database.ts";
import {
  authUsers,
  invitations,
  memberships,
  profiles,
  spaces,
} from "./schema.ts";

type Transaction = Parameters<
  Parameters<StepableDatabase["transaction"]>[0]
>[0];

type InvitationRow = typeof invitations.$inferSelect;

async function lockSpaceAdministration(
  transaction: Transaction,
  spaceId: string,
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`memberships:${spaceId}`}, 0))`,
  );
}

async function canManageInvitations(
  transaction: Transaction,
  actorIdentityId: string,
  spaceId: string,
) {
  const [actor] = await transaction
    .select({ role: memberships.role, status: memberships.status })
    .from(memberships)
    .where(
      and(
        eq(memberships.spaceId, spaceId),
        eq(memberships.profileId, actorIdentityId),
      ),
    )
    .limit(1);
  return Boolean(
    actor &&
    allowsSpaceAction(actor.status, actor.role, "gestionar_invitaciones"),
  );
}

function toSpaceInvitation(row: InvitationRow): SpaceInvitation {
  return {
    id: row.id,
    spaceId: row.spaceId,
    email: row.email,
    role: row.role,
    status: row.status,
    deliveryStatus: row.deliveryStatus,
    expiresAt: row.expiresAt,
    deliveredAt: row.deliveredAt,
    createdAt: row.createdAt,
  };
}

async function expireInvitationIfNeeded(
  transaction: Transaction,
  row: InvitationRow,
  now: Date,
): Promise<InvitationRow> {
  if (row.status !== "pendiente" || row.expiresAt > now) {
    return row;
  }

  const [expired] = await transaction
    .update(invitations)
    .set({ status: "vencida", updatedAt: now })
    .where(and(eq(invitations.id, row.id), eq(invitations.status, "pendiente")))
    .returning();

  return expired ?? { ...row, status: "vencida", updatedAt: now };
}

export class PostgresInvitationRepository implements InvitationRepository {
  constructor(private readonly database: StepableDatabase) {}

  async createInvitation(
    input: CreateInvitationInput,
  ): Promise<CreateInvitationResult> {
    return this.database.transaction(async (transaction) => {
      await lockSpaceAdministration(transaction, input.spaceId);
      if (
        !(await canManageInvitations(
          transaction,
          input.invitedBy,
          input.spaceId,
        ))
      ) {
        return { kind: "unauthorized" as const };
      }

      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${input.spaceId}:${input.email}`}, 0))`,
      );

      const [space] = await transaction
        .select({ name: spaces.name })
        .from(spaces)
        .where(eq(spaces.id, input.spaceId))
        .limit(1);
      if (!space) {
        return { kind: "pending_exists" as const };
      }

      const [identity] = await transaction
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(sql`lower(${authUsers.email}) = ${input.email}`)
        .limit(1);

      if (identity) {
        const [membership] = await transaction
          .select({ role: memberships.role, status: memberships.status })
          .from(memberships)
          .where(
            and(
              eq(memberships.spaceId, input.spaceId),
              eq(memberships.profileId, identity.id),
            ),
          )
          .limit(1);

        if (membership?.status === "activa") {
          return membership.role === input.role
            ? { kind: "already_member" as const, role: membership.role }
            : {
                kind: "member_role_conflict" as const,
                role: membership.role,
              };
        }
      }

      const [existing] = await transaction
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.spaceId, input.spaceId),
            eq(invitations.email, input.email),
            inArray(invitations.status, ["pendiente", "vencida"]),
          ),
        )
        .orderBy(desc(invitations.createdAt))
        .limit(1)
        .for("update");

      if (existing) {
        await expireInvitationIfNeeded(transaction, existing, input.now);
        return { kind: "pending_exists" as const };
      }

      const [created] = await transaction
        .insert(invitations)
        .values({
          spaceId: input.spaceId,
          email: input.email,
          role: input.role,
          invitedBy: input.invitedBy,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();

      await recordAccessAuditEvent(transaction, {
        action: "invitacion_creada",
        actor: { type: "identidad", profileId: input.invitedBy },
        spaceId: input.spaceId,
        targetType: "invitacion",
        targetId: created.id,
        occurredAt: input.now,
      });

      return {
        kind: "created" as const,
        invitation: toSpaceInvitation(created),
        spaceName: space.name,
      };
    });
  }

  async listInvitations(
    spaceId: string,
    now: Date,
  ): Promise<SpaceInvitation[]> {
    return this.database.transaction(async (transaction) => {
      await transaction
        .update(invitations)
        .set({ status: "vencida", updatedAt: now })
        .where(
          and(
            eq(invitations.spaceId, spaceId),
            eq(invitations.status, "pendiente"),
            lte(invitations.expiresAt, now),
          ),
        );

      const rows = await transaction
        .select()
        .from(invitations)
        .where(eq(invitations.spaceId, spaceId))
        .orderBy(desc(invitations.createdAt), desc(invitations.id));
      return rows.map(toSpaceInvitation);
    });
  }

  async prepareResend(input: {
    actorIdentityId: string;
    invitationId: string;
    spaceId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<PrepareResendResult> {
    return this.database.transaction(async (transaction) => {
      await lockSpaceAdministration(transaction, input.spaceId);
      if (
        !(await canManageInvitations(
          transaction,
          input.actorIdentityId,
          input.spaceId,
        ))
      ) {
        return { kind: "unauthorized" as const };
      }

      const [selected] = await transaction
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.id, input.invitationId),
            eq(invitations.spaceId, input.spaceId),
          ),
        )
        .limit(1)
        .for("update");
      if (!selected) {
        return { kind: "not_found" as const };
      }

      const invitation = await expireInvitationIfNeeded(
        transaction,
        selected,
        input.now,
      );
      if (
        !(["pendiente", "vencida"] as InvitationStatus[]).includes(
          invitation.status,
        )
      ) {
        return { kind: "not_resendable" as const };
      }

      const [space] = await transaction
        .select({ name: spaces.name })
        .from(spaces)
        .where(eq(spaces.id, input.spaceId))
        .limit(1);
      if (!space) {
        return { kind: "not_found" as const };
      }

      const [updated] = await transaction
        .update(invitations)
        .set({
          tokenHash: input.tokenHash,
          status: "pendiente",
          deliveryStatus: "pendiente",
          expiresAt: input.expiresAt,
          deliveredAt: null,
          acceptedBy: null,
          acceptedAt: null,
          revokedAt: null,
          updatedAt: input.now,
        })
        .where(eq(invitations.id, invitation.id))
        .returning();

      await recordAccessAuditEvent(transaction, {
        action: "invitacion_reenviada",
        actor: { type: "identidad", profileId: input.actorIdentityId },
        spaceId: input.spaceId,
        targetType: "invitacion",
        targetId: invitation.id,
        occurredAt: input.now,
      });

      return {
        kind: "prepared" as const,
        invitation: toSpaceInvitation(updated),
        spaceName: space.name,
      };
    });
  }

  async cancelInvitation(input: {
    actorIdentityId: string;
    invitationId: string;
    spaceId: string;
    now: Date;
  }): Promise<CancelInvitationResult> {
    return this.database.transaction(async (transaction) => {
      await lockSpaceAdministration(transaction, input.spaceId);
      if (
        !(await canManageInvitations(
          transaction,
          input.actorIdentityId,
          input.spaceId,
        ))
      ) {
        return { kind: "unauthorized" as const };
      }

      const [selected] = await transaction
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.id, input.invitationId),
            eq(invitations.spaceId, input.spaceId),
          ),
        )
        .limit(1)
        .for("update");
      if (!selected) {
        return { kind: "not_found" as const };
      }
      if (selected.status === "revocada") {
        return { kind: "already_cancelled" as const };
      }
      if (selected.status === "aceptada") {
        return { kind: "not_cancellable" as const };
      }

      await transaction
        .update(invitations)
        .set({
          status: "revocada",
          revokedAt: input.now,
          updatedAt: input.now,
        })
        .where(eq(invitations.id, selected.id));
      await recordAccessAuditEvent(transaction, {
        action: "invitacion_cancelada",
        actor: { type: "identidad", profileId: input.actorIdentityId },
        spaceId: input.spaceId,
        targetType: "invitacion",
        targetId: selected.id,
        occurredAt: input.now,
      });
      return { kind: "cancelled" as const };
    });
  }

  async recordDelivery(input: {
    invitationId: string;
    tokenHash: string;
    deliveryStatus: "enviada" | "fallida";
    now: Date;
  }): Promise<boolean> {
    const updated = await this.database
      .update(invitations)
      .set({
        deliveryStatus: input.deliveryStatus,
        deliveredAt: input.deliveryStatus === "enviada" ? input.now : null,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(invitations.id, input.invitationId),
          eq(invitations.tokenHash, input.tokenHash),
          eq(invitations.status, "pendiente"),
        ),
      )
      .returning({ id: invitations.id });
    return updated.length === 1;
  }

  async findPreview(
    tokenHash: string,
    now: Date,
  ): Promise<InvitationPreview | null> {
    return this.database.transaction(async (transaction) => {
      const [selected] = await transaction
        .select({ invitation: invitations, spaceName: spaces.name })
        .from(invitations)
        .innerJoin(spaces, eq(spaces.id, invitations.spaceId))
        .where(eq(invitations.tokenHash, tokenHash))
        .limit(1)
        .for("update");
      if (!selected) {
        return null;
      }

      const invitation = await expireInvitationIfNeeded(
        transaction,
        selected.invitation,
        now,
      );
      return {
        spaceName: selected.spaceName,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      };
    });
  }

  async findAccountSetupTarget(
    tokenHash: string,
    now: Date,
  ): Promise<AccountSetupTarget> {
    return this.database.transaction(async (transaction) => {
      const [selected] = await transaction
        .select()
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .limit(1)
        .for("update");
      if (!selected) {
        return { kind: "invalid" as const };
      }

      const invitation = await expireInvitationIfNeeded(
        transaction,
        selected,
        now,
      );
      if (invitation.status !== "pendiente") {
        return { kind: "invalid" as const };
      }

      const [identity] = await transaction
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(sql`lower(${authUsers.email}) = ${invitation.email}`)
        .limit(1);
      return {
        kind: "available" as const,
        email: invitation.email,
        identityExists: Boolean(identity),
      };
    });
  }

  async acceptInvitation(input: {
    tokenHash: string;
    identityId: string;
    identityEmail: string;
    now: Date;
  }): Promise<AcceptInvitationResult> {
    return this.database.transaction(async (transaction) => {
      const [selected] = await transaction
        .select()
        .from(invitations)
        .where(eq(invitations.tokenHash, input.tokenHash))
        .limit(1)
        .for("update");
      if (!selected) {
        return { kind: "invalid" as const };
      }

      if (selected.status === "aceptada") {
        return selected.acceptedBy === input.identityId
          ? { kind: "already_accepted" as const, spaceId: selected.spaceId }
          : { kind: "invalid" as const };
      }

      const invitation = await expireInvitationIfNeeded(
        transaction,
        selected,
        input.now,
      );
      if (invitation.status === "vencida") {
        return { kind: "expired" as const };
      }
      if (invitation.status === "revocada") {
        return { kind: "cancelled" as const };
      }
      if (invitation.status !== "pendiente") {
        return { kind: "invalid" as const };
      }
      if (invitation.email !== input.identityEmail.trim().toLowerCase()) {
        return { kind: "email_mismatch" as const };
      }

      await transaction
        .insert(profiles)
        .values({ identityId: input.identityId })
        .onConflictDoNothing();

      const [membership] = await transaction
        .select({ role: memberships.role, status: memberships.status })
        .from(memberships)
        .where(
          and(
            eq(memberships.spaceId, invitation.spaceId),
            eq(memberships.profileId, input.identityId),
          ),
        )
        .limit(1)
        .for("update");

      let resultKind: "joined" | "reactivated" | "already_member";
      if (membership?.status === "activa") {
        if (membership.role !== invitation.role) {
          return { kind: "member_role_conflict" as const };
        }
        resultKind = "already_member";
      } else if (membership?.status === "revocada") {
        await transaction
          .update(memberships)
          .set({ role: invitation.role, status: "activa" })
          .where(
            and(
              eq(memberships.spaceId, invitation.spaceId),
              eq(memberships.profileId, input.identityId),
            ),
          );
        resultKind = "reactivated";
      } else {
        await transaction.insert(memberships).values({
          spaceId: invitation.spaceId,
          profileId: input.identityId,
          role: invitation.role,
          status: "activa",
        });
        resultKind = "joined";
      }

      await transaction
        .update(invitations)
        .set({
          status: "aceptada",
          acceptedBy: input.identityId,
          acceptedAt: input.now,
          updatedAt: input.now,
        })
        .where(eq(invitations.id, invitation.id));

      await recordAccessAuditEvent(transaction, {
        action: "invitacion_aceptada",
        actor: { type: "identidad", profileId: input.identityId },
        spaceId: invitation.spaceId,
        targetType: "invitacion",
        targetId: invitation.id,
        occurredAt: input.now,
      });

      return { kind: resultKind, spaceId: invitation.spaceId };
    });
  }
}
