import { and, asc, eq, sql } from "drizzle-orm";

import { allowsSpaceAction } from "../../modules/access/authorization.ts";
import type {
  ChangeMemberRoleResult,
  LeaveSpaceResult,
  MembershipRepository,
  RevokeMemberResult,
  SpaceMember,
} from "../../modules/memberships/contract.ts";

import type { StepableDatabase } from "./database.ts";
import { recordAccessAuditEvent } from "./access-audit.ts";
import { authUsers, memberships } from "./schema.ts";

type Transaction = Parameters<
  Parameters<StepableDatabase["transaction"]>[0]
>[0];

async function lockSpaceMemberships(transaction: Transaction, spaceId: string) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`memberships:${spaceId}`}, 0))`,
  );
}

async function findMembership(
  transaction: Transaction,
  spaceId: string,
  profileId: string,
) {
  const [membership] = await transaction
    .select({ role: memberships.role, status: memberships.status })
    .from(memberships)
    .where(
      and(
        eq(memberships.spaceId, spaceId),
        eq(memberships.profileId, profileId),
      ),
    )
    .limit(1);
  return membership ?? null;
}

async function countActiveResponsibles(
  transaction: Transaction,
  spaceId: string,
): Promise<number> {
  const [row] = await transaction
    .select({ count: sql<number>`count(*)::int` })
    .from(memberships)
    .where(
      and(
        eq(memberships.spaceId, spaceId),
        eq(memberships.role, "responsable"),
        eq(memberships.status, "activa"),
      ),
    );
  return row.count;
}

async function canManageMembers(
  transaction: Transaction,
  actorIdentityId: string,
  spaceId: string,
) {
  const actor = await findMembership(transaction, spaceId, actorIdentityId);
  return Boolean(
    actor && allowsSpaceAction(actor.status, actor.role, "gestionar_miembros"),
  );
}

export class PostgresMembershipRepository implements MembershipRepository {
  constructor(private readonly database: StepableDatabase) {}

  async listMembersForManager(
    actorIdentityId: string,
    spaceId: string,
  ): Promise<SpaceMember[] | null> {
    return this.database.transaction(async (transaction) => {
      if (!(await canManageMembers(transaction, actorIdentityId, spaceId))) {
        return null;
      }

      return transaction
        .select({
          profileId: memberships.profileId,
          email: authUsers.email,
          role: memberships.role,
          status: memberships.status,
        })
        .from(memberships)
        .innerJoin(authUsers, eq(authUsers.id, memberships.profileId))
        .where(eq(memberships.spaceId, spaceId))
        .orderBy(
          asc(memberships.status),
          asc(authUsers.email),
          asc(memberships.profileId),
        );
    });
  }

  async changeMemberRole(input: {
    actorIdentityId: string;
    spaceId: string;
    targetProfileId: string;
    role: "responsable" | "integrante";
  }): Promise<ChangeMemberRoleResult> {
    return this.database.transaction(async (transaction) => {
      await lockSpaceMemberships(transaction, input.spaceId);
      if (
        !(await canManageMembers(
          transaction,
          input.actorIdentityId,
          input.spaceId,
        ))
      ) {
        return { kind: "unauthorized" as const };
      }

      const target = await findMembership(
        transaction,
        input.spaceId,
        input.targetProfileId,
      );
      if (!target) return { kind: "not_found" as const };
      if (target.status !== "activa") return { kind: "inactive" as const };
      if (target.role === input.role) return { kind: "unchanged" as const };

      if (
        target.role === "responsable" &&
        input.role === "integrante" &&
        (await countActiveResponsibles(transaction, input.spaceId)) <= 1
      ) {
        return { kind: "last_responsible" as const };
      }

      await transaction
        .update(memberships)
        .set({ role: input.role })
        .where(
          and(
            eq(memberships.spaceId, input.spaceId),
            eq(memberships.profileId, input.targetProfileId),
            eq(memberships.status, "activa"),
          ),
        );
      await recordAccessAuditEvent(transaction, {
        action: "rol_membresia_cambiado",
        actor: { type: "identidad", profileId: input.actorIdentityId },
        spaceId: input.spaceId,
        targetType: "membresia",
        targetId: input.targetProfileId,
      });
      return { kind: "updated" as const };
    });
  }

  async revokeMember(input: {
    actorIdentityId: string;
    spaceId: string;
    targetProfileId: string;
  }): Promise<RevokeMemberResult> {
    return this.database.transaction(async (transaction) => {
      await lockSpaceMemberships(transaction, input.spaceId);
      if (
        !(await canManageMembers(
          transaction,
          input.actorIdentityId,
          input.spaceId,
        ))
      ) {
        return { kind: "unauthorized" as const };
      }

      const target = await findMembership(
        transaction,
        input.spaceId,
        input.targetProfileId,
      );
      if (!target) return { kind: "not_found" as const };
      if (target.status !== "activa") return { kind: "inactive" as const };
      if (
        target.role === "responsable" &&
        (await countActiveResponsibles(transaction, input.spaceId)) <= 1
      ) {
        return { kind: "last_responsible" as const };
      }

      await transaction
        .update(memberships)
        .set({ status: "revocada" })
        .where(
          and(
            eq(memberships.spaceId, input.spaceId),
            eq(memberships.profileId, input.targetProfileId),
            eq(memberships.status, "activa"),
          ),
        );
      await recordAccessAuditEvent(transaction, {
        action: "membresia_retirada",
        actor: { type: "identidad", profileId: input.actorIdentityId },
        spaceId: input.spaceId,
        targetType: "membresia",
        targetId: input.targetProfileId,
      });
      return { kind: "revoked" as const };
    });
  }

  async leaveSpace(input: {
    actorIdentityId: string;
    spaceId: string;
  }): Promise<LeaveSpaceResult> {
    return this.database.transaction(async (transaction) => {
      await lockSpaceMemberships(transaction, input.spaceId);
      const actor = await findMembership(
        transaction,
        input.spaceId,
        input.actorIdentityId,
      );
      if (
        !actor ||
        !allowsSpaceAction(actor.status, actor.role, "abandonar_espacio")
      ) {
        return { kind: "unauthorized" as const };
      }
      if (
        actor.role === "responsable" &&
        (await countActiveResponsibles(transaction, input.spaceId)) <= 1
      ) {
        return { kind: "last_responsible" as const };
      }

      await transaction
        .update(memberships)
        .set({ status: "revocada" })
        .where(
          and(
            eq(memberships.spaceId, input.spaceId),
            eq(memberships.profileId, input.actorIdentityId),
            eq(memberships.status, "activa"),
          ),
        );
      await recordAccessAuditEvent(transaction, {
        action: "membresia_abandonada",
        actor: { type: "identidad", profileId: input.actorIdentityId },
        spaceId: input.spaceId,
        targetType: "membresia",
        targetId: input.actorIdentityId,
      });
      return { kind: "left" as const };
    });
  }
}
