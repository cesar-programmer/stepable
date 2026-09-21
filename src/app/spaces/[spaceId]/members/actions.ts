"use server";

import { redirect } from "next/navigation";

import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresMembershipRepository } from "@/adapters/postgres/membership-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import {
  memberMutationInputSchema,
  memberRoleChangeInputSchema,
} from "@/modules/memberships/input";
import {
  changeSpaceMemberRole,
  revokeSpaceMember,
} from "@/modules/memberships/service";

function destination(spaceId: string, type: "error" | "notice", code: string) {
  return `/spaces/${spaceId}/members?${type}=${encodeURIComponent(code)}`;
}

async function currentIdentityId(spaceId: string) {
  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect(`/login?next=${encodeURIComponent(`/spaces/${spaceId}/members`)}`);
  }
  return currentIdentity.id;
}

export async function changeMemberRoleAction(formData: FormData) {
  const input = memberRoleChangeInputSchema.safeParse({
    spaceId: formData.get("spaceId"),
    targetProfileId: formData.get("targetProfileId"),
    role: formData.get("role"),
  });
  if (!input.success) redirect("/spaces");

  const identityId = await currentIdentityId(input.data.spaceId);
  const result = await changeSpaceMemberRole(
    new PostgresMembershipRepository(getApplicationDatabase()),
    { identityId, ...input.data },
  );
  if (
    result.kind === "updated" &&
    identityId === input.data.targetProfileId &&
    input.data.role === "integrante"
  ) {
    redirect(`/spaces/${input.data.spaceId}?notice=role-updated`);
  }
  redirect(
    destination(
      input.data.spaceId,
      result.kind === "updated" || result.kind === "unchanged"
        ? "notice"
        : "error",
      result.kind,
    ),
  );
}

export async function revokeMemberAction(formData: FormData) {
  const input = memberMutationInputSchema.safeParse({
    spaceId: formData.get("spaceId"),
    targetProfileId: formData.get("targetProfileId"),
  });
  if (!input.success) redirect("/spaces");

  const identityId = await currentIdentityId(input.data.spaceId);
  const result = await revokeSpaceMember(
    new PostgresMembershipRepository(getApplicationDatabase()),
    { identityId, ...input.data },
  );
  if (result.kind === "revoked" && identityId === input.data.targetProfileId) {
    redirect("/spaces?notice=left-space");
  }
  redirect(
    destination(
      input.data.spaceId,
      result.kind === "revoked" ? "notice" : "error",
      result.kind,
    ),
  );
}
