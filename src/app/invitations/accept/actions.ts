"use server";

import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresInvitationRepository } from "@/adapters/postgres/invitation-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { SupabaseInvitedIdentityGateway } from "@/adapters/supabase/invited-identity-gateway";
import { invitationTokenSchema } from "@/modules/invitations/input";
import {
  acceptSpaceInvitation,
  inspectSpaceInvitation,
  requestInvitedAccountSetup,
} from "@/modules/invitations/service";

function repository() {
  return new PostgresInvitationRepository(getApplicationDatabase());
}

export async function inspectInvitationAction(token: string) {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) return { kind: "invalid" as const };
  const preview = await inspectSpaceInvitation(repository(), parsed.data);
  if (!preview) return { kind: "invalid" as const };
  return {
    kind: "found" as const,
    preview: { ...preview, expiresAt: preview.expiresAt.toISOString() },
  };
}

export async function requestInvitedAccountAction(token: string) {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) return "invalid" as const;
  return requestInvitedAccountSetup(
    repository(),
    new SupabaseInvitedIdentityGateway(),
    parsed.data,
  );
}

export async function acceptInvitationAction(token: string) {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) return { kind: "invalid" as const };
  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) return { kind: "authentication_required" as const };
  return acceptSpaceInvitation(repository(), {
    token: parsed.data,
    identityId: currentIdentity.id,
    identityEmail: currentIdentity.email,
    emailVerified: currentIdentity.emailVerified,
  });
}
