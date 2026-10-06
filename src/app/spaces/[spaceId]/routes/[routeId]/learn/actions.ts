"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { configuredMeter } from "@/adapters/ai/metering";
import { configuredModels } from "@/adapters/ai/models";
import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresKnowledgeRepository } from "@/adapters/postgres/knowledge-repository";
import { PostgresLearningRepository } from "@/adapters/postgres/learning-repository";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { askStepHelp, type StepHelpResult } from "@/modules/learning/help";
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
  const written = formData.get("answerText");
  const result = await answerStep(dependencies(), {
    ...input,
    stepId: String(formData.get("stepId") ?? ""),
    // The server checks that the response matches the step's activity.
    ...(typeof written === "string"
      ? { answerText: written }
      : { selectedOption: selected === null ? -1 : Number(selected) }),
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

export type StepHelpState =
  | { kind: "idle" }
  | { kind: "authentication_required" }
  | (StepHelpResult & { question: string });

/**
 * Only identifiers and the learner's optional doubt come from the browser;
 * the step, its state and the answer key are read on the server.
 */
export async function askStepHelpAction(
  _previous: StepHelpState,
  formData: FormData,
): Promise<StepHelpState> {
  const question = formData.get("question");
  const text = typeof question === "string" ? question : "";
  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) return { kind: "authentication_required" };

  const database = getApplicationDatabase();
  const models = configuredModels(process.env);
  const result = await askStepHelp(
    {
      ...dependencies(),
      knowledgeRepository: new PostgresKnowledgeRepository(database),
      chatModel: models.chatModel,
      embedder: models.embedder,
      meter: configuredMeter(database, process.env),
      log: (entry) => console.log(JSON.stringify(entry)),
    },
    {
      identityId: identity.id,
      spaceId: String(formData.get("spaceId") ?? ""),
      routeId: String(formData.get("routeId") ?? ""),
      stepId: String(formData.get("stepId") ?? ""),
      question: text,
    },
  );
  return { ...result, question: text };
}
