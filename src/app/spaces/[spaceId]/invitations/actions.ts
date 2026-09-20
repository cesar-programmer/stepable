"use server";

import { redirect } from "next/navigation";

import { MailpitInvitationMailer } from "@/adapters/mailpit/invitation-mailer";
import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresInvitationRepository } from "@/adapters/postgres/invitation-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { getServerEnvironment } from "@/lib/env";
import {
  createInvitationInputSchema,
  invitationMutationInputSchema,
} from "@/modules/invitations/input";
import {
  cancelSpaceInvitation,
  issueSpaceInvitation,
  resendSpaceInvitation,
} from "@/modules/invitations/service";

function destination(spaceId: string, type: "error" | "notice", code: string) {
  return `/spaces/${spaceId}/invitations?${type}=${encodeURIComponent(code)}`;
}

async function managementDependencies() {
  const database = getApplicationDatabase();
  const environment = getServerEnvironment();
  return {
    accessRepository: new PostgresAccessRepository(database),
    invitationRepository: new PostgresInvitationRepository(database),
    mailer: new MailpitInvitationMailer(environment.STEPABLE_MAILPIT_URL),
    applicationUrl: environment.STEPABLE_APP_URL,
  };
}

async function authenticatedIdentity() {
  return (await createSupabaseIdentityGateway()).currentIdentity();
}

export async function createInvitationAction(formData: FormData) {
  const input = createInvitationInputSchema.safeParse({
    spaceId: formData.get("spaceId"),
    email: formData.get("email"),
    role: formData.get("role") ?? undefined,
  });
  if (!input.success) {
    redirect("/spaces");
  }
  const identity = await authenticatedIdentity();
  if (!identity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${input.data.spaceId}/invitations`)}`,
    );
  }
  const result = await issueSpaceInvitation(await managementDependencies(), {
    identityId: identity.id,
    ...input.data,
  });
  const successful = result === "sent";
  redirect(
    destination(input.data.spaceId, successful ? "notice" : "error", result),
  );
}

export async function resendInvitationAction(formData: FormData) {
  const input = invitationMutationInputSchema.safeParse({
    spaceId: formData.get("spaceId"),
    invitationId: formData.get("invitationId"),
  });
  if (!input.success) {
    redirect("/spaces");
  }
  const identity = await authenticatedIdentity();
  if (!identity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${input.data.spaceId}/invitations`)}`,
    );
  }
  const result = await resendSpaceInvitation(await managementDependencies(), {
    identityId: identity.id,
    ...input.data,
  });
  redirect(
    destination(
      input.data.spaceId,
      result === "sent" ? "notice" : "error",
      result,
    ),
  );
}

export async function cancelInvitationAction(formData: FormData) {
  const input = invitationMutationInputSchema.safeParse({
    spaceId: formData.get("spaceId"),
    invitationId: formData.get("invitationId"),
  });
  if (!input.success) {
    redirect("/spaces");
  }
  const identity = await authenticatedIdentity();
  if (!identity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${input.data.spaceId}/invitations`)}`,
    );
  }
  const result = await cancelSpaceInvitation(await managementDependencies(), {
    identityId: identity.id,
    ...input.data,
  });
  redirect(
    destination(
      input.data.spaceId,
      result.kind === "cancelled" || result.kind === "already_cancelled"
        ? "notice"
        : "error",
      result.kind,
    ),
  );
}
