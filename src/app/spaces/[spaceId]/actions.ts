"use server";

import { redirect } from "next/navigation";

import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresMembershipRepository } from "@/adapters/postgres/membership-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { leaveSpaceInputSchema } from "@/modules/memberships/input";
import { leaveSpace } from "@/modules/memberships/service";

export async function leaveSpaceAction(formData: FormData) {
  const input = leaveSpaceInputSchema.safeParse({
    spaceId: formData.get("spaceId"),
  });
  if (!input.success) redirect("/spaces");

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${input.data.spaceId}`)}`,
    );
  }

  const result = await leaveSpace(
    new PostgresMembershipRepository(getApplicationDatabase()),
    { identityId: currentIdentity.id, spaceId: input.data.spaceId },
  );
  if (result.kind === "left") {
    redirect("/spaces?notice=left-space");
  }
  if (result.kind === "last_responsible") {
    redirect(`/spaces/${input.data.spaceId}/settings?error=last-responsible`);
  }
  redirect("/spaces");
}
