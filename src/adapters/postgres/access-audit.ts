import type {
  AccessAuditAction,
  AccessAuditTargetType,
} from "../../modules/access/audit.ts";

import type { StepableDatabase } from "./database.ts";
import { accessAuditEvents } from "./schema.ts";

type Transaction = Parameters<
  Parameters<StepableDatabase["transaction"]>[0]
>[0];

type AuditActor =
  { type: "identidad"; profileId: string } | { type: "operador" };

export async function recordAccessAuditEvent(
  transaction: Transaction,
  input: {
    action: AccessAuditAction;
    actor: AuditActor;
    spaceId: string;
    targetType: AccessAuditTargetType;
    targetId: string;
    occurredAt?: Date;
  },
) {
  await transaction.insert(accessAuditEvents).values({
    action: input.action,
    actorType: input.actor.type,
    actorProfileId:
      input.actor.type === "identidad" ? input.actor.profileId : null,
    spaceId: input.spaceId,
    targetType: input.targetType,
    targetId: input.targetId,
    occurredAt: input.occurredAt,
  });
}
