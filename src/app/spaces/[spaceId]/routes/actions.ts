"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getApplicationSourceQueue } from "@/adapters/pg-boss/source-queue";
import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { getServerEnvironment } from "@/lib/env";
import type {
  RequestedActivity,
  RouteMutationResult,
} from "@/modules/routes/contract";
import { normalizeCode } from "@/modules/routes/generation";
import {
  deleteRouteDraft,
  deleteRouteStep,
  editRouteStep,
  moveRouteStep,
  publishRoute,
  requestRouteDraft,
  requestRouteRegeneration,
  updateRouteRequest,
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

function finish(
  path: string,
  result: RouteMutationResult,
  notice: string,
  stepId?: string,
) {
  if (result.kind === "unauthorized" || result.kind === "not_found") {
    notFound();
  }
  // The editor reopens on the step that was acted on.
  const step = stepId ? `&paso=${encodeURIComponent(stepId)}` : "";
  redirect(
    result.kind === "ok"
      ? `${path}?notice=${notice}${step}`
      : `${path}?error=${result.kind}${step}`,
  );
}

export type CreateRouteState = { error: string | null };

/**
 * Creates a draft and queues its generation. Errors come back to the form,
 * so what the responsible wrote stays on screen.
 */
export async function createRouteFormAction(
  _previous: CreateRouteState,
  formData: FormData,
): Promise<CreateRouteState> {
  const spaceId = z.uuid().safeParse(formData.get("spaceId"));
  if (!spaceId.success) notFound();
  const listPath = `/spaces/${spaceId.data}/routes`;
  const result = await requestRouteDraft(await dependencies(), {
    identityId: await identityId(`${listPath}/new`),
    spaceId: spaceId.data,
    objective: String(formData.get("objective") ?? ""),
    sourceIds: formData.getAll("sourceIds").map(String),
    // Unknown values are rejected by the service schema.
    activityTypes: formData
      .getAll("activityTypes")
      .map(String) as RequestedActivity[],
  });
  if (result.kind === "unauthorized") notFound();
  if (result.kind === "queued") {
    redirect(`${listPath}/${result.routeId}?notice=generation_queued`);
  }
  return { error: result.kind };
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

export type SaveStepState = {
  kind: "idle" | RouteMutationResult["kind"];
  stepId: string | null;
  /** Distinguishes two consecutive results of the same kind. */
  at: number;
};

/**
 * Saves one step and returns the outcome to the editor (no redirect), so
 * unsaved text survives a validation error. A saved step refreshes the page
 * data, including the edit version used to detect conflicts.
 */
export async function saveStepFormAction(
  _previous: SaveStepState,
  formData: FormData,
): Promise<SaveStepState> {
  const form = routeForm(formData);
  // Empty option fields are dropped; the correct answer follows its option.
  const entries = [0, 1, 2, 3]
    .map((index) => ({
      index,
      text: String(formData.get(`option${index}`) ?? "").trim(),
    }))
    .filter((entry) => entry.text.length > 0);
  const correct = Number(formData.get("correctOption"));
  const fillIn = formData.get("activityType") === "completar";
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
      activityType: fillIn ? "completar" : "opcion_multiple",
      // Fields of the other activity type are ignored.
      options: fillIn ? [] : entries.map((entry) => entry.text),
      correctOption: fillIn
        ? null
        : entries.findIndex((entry) => entry.index === correct),
      acceptedAnswers: fillIn
        ? String(formData.get("acceptedAnswers") ?? "")
            .split(/\r?\n/)
            .map((answer) => answer.trim())
            .filter((answer) => answer.length > 0)
        : null,
      explanation: String(formData.get("explanation") ?? ""),
    },
  });
  if (result.kind === "unauthorized" || result.kind === "not_found") {
    notFound();
  }
  if (result.kind === "ok") revalidatePath(form.path);
  return {
    kind: result.kind,
    stepId: String(formData.get("stepId") ?? ""),
    at: Date.now(),
  };
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
  finish(form.path, result, "step_moved", String(formData.get("stepId") ?? ""));
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

/** Objective, sources and types of a failed or insufficient draft. */
async function saveRequest(
  formData: FormData,
  activityTypes?: RequestedActivity[],
) {
  const form = routeForm(formData);
  const result = await updateRouteRequest(await dependencies(), {
    identityId: await identityId(form.path),
    spaceId: form.spaceId,
    routeId: form.routeId,
    editVersion: form.editVersion,
    objective: String(formData.get("objective") ?? ""),
    sourceIds: formData.getAll("sourceIds").map(String),
    // Unknown values are rejected by the service schema.
    activityTypes:
      activityTypes ??
      (formData.getAll("activityTypes").map(String) as RequestedActivity[]),
  });
  return { form, result };
}

/** Saves the adjustments only: no model call and no generation attempt. */
export async function saveRouteRequestAction(formData: FormData) {
  const { form, result } = await saveRequest(formData);
  finish(form.path, result, "request_saved");
}

/** Explicit, user-chosen fallback; it does not generate anything. */
export async function multipleChoiceOnlyAction(formData: FormData) {
  const { form, result } = await saveRequest(formData, ["opcion_multiple"]);
  finish(form.path, result, "request_saved");
}

/** Saves the adjustments and queues one new generation of the same route. */
export async function generateWithChangesAction(formData: FormData) {
  const { form, result } = await saveRequest(formData);
  if (result.kind !== "ok") return finish(form.path, result, "");
  const queued = await requestRouteRegeneration(await dependencies(), {
    identityId: await identityId(form.path),
    spaceId: form.spaceId,
    routeId: form.routeId,
  });
  if (queued.kind === "unauthorized" || queued.kind === "not_found") {
    notFound();
  }
  redirect(
    queued.kind === "queued"
      ? `${form.path}?notice=generation_queued`
      : `${form.path}?error=${queued.kind}`,
  );
}

const deleteDraftSchema = z.object({
  spaceId: z.uuid(),
  routeId: z.uuid(),
  // Where the person was, so the result shows up there.
  from: z.enum(["inicio", "rutas", "ruta"]),
});

/** RN-40: deletes a draft after the confirmation dialog. */
export async function deleteDraftAction(formData: FormData) {
  const parsed = deleteDraftSchema.safeParse({
    spaceId: formData.get("spaceId"),
    routeId: formData.get("routeId"),
    from: formData.get("from"),
  });
  if (!parsed.success) notFound();
  const { spaceId, routeId, from } = parsed.data;
  const routePath = `/spaces/${spaceId}/routes/${routeId}`;
  const result = await deleteRouteDraft(await dependencies(), {
    identityId: await identityId(routePath),
    spaceId,
    routeId,
  });
  if (result.kind === "unauthorized" || result.kind === "not_found") {
    notFound();
  }
  const back =
    from === "inicio" ? `/spaces/${spaceId}` : `/spaces/${spaceId}/routes`;
  // The sidebar counts and the home cards change too.
  revalidatePath(`/spaces/${spaceId}`, "layout");
  redirect(
    result.kind === "ok"
      ? `${back}?notice=draft_deleted`
      : `${from === "ruta" ? routePath : back}?error=${result.kind}`,
  );
}
