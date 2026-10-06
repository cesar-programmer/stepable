"use server";

import { configuredMeter } from "@/adapters/ai/metering";
import { configuredModels } from "@/adapters/ai/models";
import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresKnowledgeRepository } from "@/adapters/postgres/knowledge-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { spaceIdSchema } from "@/modules/access/input";
import type { AssistantResult } from "@/modules/knowledge/contract";
import { askAssistant } from "@/modules/knowledge/service";

export type AssistantState =
  | { kind: "idle" }
  | { kind: "authentication_required" }
  | (AssistantResult & { question: string });

export async function askAssistantAction(
  _previous: AssistantState,
  formData: FormData,
): Promise<AssistantState> {
  const spaceId = spaceIdSchema.safeParse(formData.get("spaceId"));
  const question = formData.get("question");
  if (!spaceId.success || typeof question !== "string") {
    return { kind: "invalid_question", question: "" };
  }

  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) return { kind: "authentication_required" };

  const database = getApplicationDatabase();
  const models = configuredModels(process.env);
  const result = await askAssistant(
    {
      accessRepository: new PostgresAccessRepository(database),
      knowledgeRepository: new PostgresKnowledgeRepository(database),
      chatModel: models.chatModel,
      embedder: models.embedder,
      meter: configuredMeter(database, process.env),
      log: (entry) => console.log(JSON.stringify(entry)),
    },
    { identityId: identity.id, spaceId: spaceId.data, question },
  );
  return { ...result, question };
}
