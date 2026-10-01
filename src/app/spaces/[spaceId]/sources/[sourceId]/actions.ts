"use server";

import { notFound, redirect } from "next/navigation";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { sourceIdentifiersSchema } from "@/modules/sources/input";
import { deleteSource, retrySourceProcessing } from "@/modules/sources/service";

import { sourceUploadDependencies } from "../dependencies";

export async function retrySourceAction(formData: FormData) {
  const parsed = sourceIdentifiersSchema.safeParse({
    spaceId: formData.get("spaceId"),
    sourceId: formData.get("sourceId"),
  });
  if (!parsed.success) notFound();
  const { spaceId, sourceId } = parsed.data;
  const returnPath = `/spaces/${spaceId}/sources/${sourceId}`;

  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) redirect(`/login?next=${encodeURIComponent(returnPath)}`);

  const result = await retrySourceProcessing(await sourceUploadDependencies(), {
    identityId: identity.id,
    spaceId,
    sourceId,
  });
  if (result.kind === "unauthorized" || result.kind === "not_found") {
    notFound();
  }
  redirect(
    result.kind === "queued" || result.kind === "already_queued"
      ? `${returnPath}?notice=${result.kind === "queued" ? "retry_queued" : "already_queued"}`
      : `${returnPath}?error=${result.kind}`,
  );
}

export async function deleteSourceAction(formData: FormData) {
  const parsed = sourceIdentifiersSchema.safeParse({
    spaceId: formData.get("spaceId"),
    sourceId: formData.get("sourceId"),
  });
  if (!parsed.success) notFound();
  const { spaceId, sourceId } = parsed.data;
  const returnPath = `/spaces/${spaceId}/sources/${sourceId}`;
  if (formData.get("confirmacion") !== "eliminar") {
    redirect(`${returnPath}?error=confirmacion_requerida`);
  }

  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) redirect(`/login?next=${encodeURIComponent(returnPath)}`);

  const result = await deleteSource(await sourceUploadDependencies(), {
    identityId: identity.id,
    spaceId,
    sourceId,
  });
  if (result.kind !== "deleted") notFound();
  redirect(`/spaces/${spaceId}/sources?notice=source_deleted`);
}
