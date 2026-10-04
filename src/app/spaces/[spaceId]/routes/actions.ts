"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getApplicationSourceQueue } from "@/adapters/pg-boss/source-queue";
import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { getServerEnvironment } from "@/lib/env";
import type { RouteMutationResult } from "@/modules/routes/contract";
import { normalizeCode } from "@/modules/routes/generation";
import {
  deleteRouteStep,
  editRouteStep,
  moveRouteStep,
  publishRoute,
  requestRouteDraft,
  requestRouteRegeneration,
} from "@/modules/routes/service";

const routeFormSchema = z.object({
  spaceId: z.uuid(),
  routeId: z.uuid(),
  editVersion: z.coerce.number().int().min(0),
});

async function dependencies() {
  const database = getApplicationDatabase();
  return {
    accessRepository: new PostgresAccessRepository(database),
    routeRepository: new PostgresRouteRepository(
      database,
      await getApplicationSourceQueue(getServerEnvironment().DATABASE_URL),
    ),
  };
}

async function identityId(returnPath: string): Promise<string> {
  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  return identity.id;
}

function routeForm(formData: FormData) {
  const parsed = routeFormSchema.safeParse({
    spaceId: formData.get("spaceId"),
    routeId: formData.get("routeId"),
    editVersion: formData.get("editVersion"),
  });
  if (!parsed.success) notFound();
  return {
    ...parsed.data,
    path: `/spaces/${parsed.data.spaceId}/routes/${parsed.data.routeId}`,
  };
}

function finish(path: string, result: RouteMutationResult, notice: string) {
  if (result.kind === "unauthorized" || result.kind === "not_found") {
    notFound();
  }
  redirect(
    result.kind === "ok"
      ? `${path}?notice=${notice}`
      : `${path}?error=${result.kind}`,
  );
}

export async function createRouteAction(formData: FormData) {
  const spaceId = z.uuid().safeParse(formData.get("spaceId"));
  if (!spaceId.success) notFound();
  const listPath = `/spaces/${spaceId.data}/routes`;
  const result = await requestRouteDraft(await dependencies(), {
    identityId: await identityId(listPath),
    spaceId: spaceId.data,
    objective: String(formData.get("objective") ?? ""),
    sourceIds: formData.getAll("sourceIds").map(String),
  });
  if (result.kind === "unauthorized") notFound();
  redirect(
    result.kind === "queued"
      ? `${listPath}/${result.routeId}?notice=generation_queued`
      : `${listPath}?error=${result.kind}`,
  );
}

export async function regenerateRouteAction(formData: FormData) {
  const form = routeForm(formData);
  const result = await requestRouteRegeneration(await dependencies(), {
    identityId: await identityId(form.path),
    spaceId: form.spaceId,
    routeId: form.routeId,
  });
  if (result.kind === "unauthorized" || result.kind === "not_found") {
    notFound();
  }
  redirect(
    result.kind === "queued"
      ? `${form.path}?notice=generation_queued`
      : `${form.path}?error=${result.kind}`,
  );
}

export async function saveStepAction(formData: FormData) {
  const form = routeForm(formData);
  // Empty option fields are dropped; the correct answer follows its option.
  const entries = [0, 1, 2, 3]
    .map((index) => ({
      index,
      text: String(formData.get(`option${index}`) ?? "").trim(),
    }))
    .filter((entry) => entry.text.length > 0);
  const correct = Number(formData.get("correctOption"));
  const result = await editRouteStep(await dependencies(), {
    identityId: await identityId(form.path),
    spaceId: form.spaceId,
    routeId: form.routeId,
    editVersion: form.editVersion,
    stepId: String(formData.get("stepId") ?? ""),
    edit: {
      title: String(formData.get("title") ?? ""),
      lesson: String(formData.get("lesson") ?? ""),
      question: String(formData.get("question") ?? ""),
      code: normalizeCode(String(formData.get("code") ?? ""))
        ? {
            content: String(formData.get("code")),
            language: String(formData.get("codeLanguage") ?? ""),
            origin:
              formData.get("codeOrigin") === "fuente"
                ? "fuente"
                : "ilustrativo",
          }
        : null,
      options: entries.map((entry) => entry.text),
      correctOption: entries.findIndex((entry) => entry.index === correct),
      explanation: String(formData.get("explanation") ?? ""),
    },
  });
  finish(form.path, result, "step_saved");
}

export async function moveStepAction(formData: FormData) {
  const form = routeForm(formData);
  const result = await moveRouteStep(await dependencies(), {
    identityId: await identityId(form.path),
    spaceId: form.spaceId,
    routeId: form.routeId,
    editVersion: form.editVersion,
    stepId: String(formData.get("stepId") ?? ""),
    direction: formData.get("direction") === "up" ? "up" : "down",
  });
  finish(form.path, result, "step_moved");
}

export async function deleteStepAction(formData: FormData) {
  const form = routeForm(formData);
  const result = await deleteRouteStep(await dependencies(), {
    identityId: await identityId(form.path),
    spaceId: form.spaceId,
    routeId: form.routeId,
    editVersion: form.editVersion,
    stepId: String(formData.get("stepId") ?? ""),
  });
  finish(form.path, result, "step_deleted");
}

export async function publishRouteAction(formData: FormData) {
  const form = routeForm(formData);
  const result = await publishRoute(await dependencies(), {
    identityId: await identityId(form.path),
    spaceId: form.spaceId,
    routeId: form.routeId,
    editVersion: form.editVersion,
  });
  finish(form.path, result, "route_published");
}
