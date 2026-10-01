"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresLearningRepository } from "@/adapters/postgres/learning-repository";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { answerStep, startRoute } from "@/modules/learning/service";

const idsSchema = z.object({ spaceId: z.uuid(), routeId: z.uuid() });

function dependencies() {
  const database = getApplicationDatabase();
  return {
    accessRepository: new PostgresAccessRepository(database),
    routeRepository: new PostgresRouteRepository(database, null),
    learningRepository: new PostgresLearningRepository(database),
  };
}

async function context(formData: FormData) {
  const ids = idsSchema.safeParse({
    spaceId: formData.get("spaceId"),
    routeId: formData.get("routeId"),
  });
  if (!ids.success) notFound();
  const path = `/spaces/${ids.data.spaceId}/routes/${ids.data.routeId}/learn`;
  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) redirect(`/login?next=${encodeURIComponent(path)}`);
  return { ...ids.data, identityId: identity.id, path };
}

export async function startRouteAction(formData: FormData) {
  const { path, ...input } = await context(formData);
  const result = await startRoute(dependencies(), input);
  if (result.kind === "unauthorized" || result.kind === "not_found") {
    notFound();
  }
  redirect(path);
}

export async function answerStepAction(formData: FormData) {
  const { path, ...input } = await context(formData);
  const selected = formData.get("selectedOption");
  const result = await answerStep(dependencies(), {
    ...input,
    stepId: String(formData.get("stepId") ?? ""),
    selectedOption: selected === null ? -1 : Number(selected),
    submissionId: String(formData.get("submissionId") ?? ""),
  });
  if (result.kind === "unauthorized" || result.kind === "not_found") {
    notFound();
  }
  if (result.kind !== "recorded") redirect(`${path}?error=${result.kind}`);
  redirect(
    `${path}?ultimo=${result.correct ? "correcta" : "incorrecta"}&paso=${result.stepId}`,
  );
}
