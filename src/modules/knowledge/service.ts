import { authorizeSpaceAction } from "../access/authorization.ts";
import { AiBudgetExceededError } from "../usage/contract.ts";
import type { AiMeter } from "../usage/meter.ts";
import type { AccessRepository } from "../access/contract.ts";

import { parseModelAnswer } from "./answer.ts";
import {
  assistantLimits,
  type AssistantResult,
  type ChatModel,
  type Citation,
  type KnowledgeRepository,
  type RetrievedFragment,
  type TextEmbedder,
} from "./contract.ts";
import { buildAssistantPrompt } from "./prompt.ts";
import {
  describeLocation,
  mergeCandidates,
  prepareFragments,
} from "./retrieval.ts";

export type AssistantDependencies = {
  accessRepository: AccessRepository;
  knowledgeRepository: KnowledgeRepository;
  chatModel: ChatModel | null;
  embedder: TextEmbedder | null;
  /** RF-10: reserves estimated consumption before each real call. */
  meter?: AiMeter;
  log?: (entry: Record<string, unknown>) => void;
};

export function toCitations(
  refs: number[],
  fragments: RetrievedFragment[],
): Citation[] {
  return refs.map((ref) => {
    const fragment = fragments[ref - 1];
    return {
      ref,
      sourceId: fragment.sourceId,
      sourceTitle: fragment.sourceTitle,
      versionNumber: fragment.versionNumber,
      location: describeLocation(fragment),
    };
  });
}

/**
 * Answers a question with evidence from the current versions of the space's
 * sources. Membership is checked before anything is retrieved or sent; the
 * model only receives the question and the retrieved fragments.
 */
export async function askAssistant(
  dependencies: AssistantDependencies,
  input: { identityId: string; spaceId: string; question: string },
): Promise<AssistantResult> {
  const question = input.question.replace(/\s+/g, " ").trim();
  if (
    question.length < assistantLimits.questionMinChars ||
    question.length > assistantLimits.questionMaxChars
  ) {
    return { kind: "invalid_question" };
  }
  if (
    !(await authorizeSpaceAction(
      dependencies.accessRepository,
      input.identityId,
      input.spaceId,
      "consultar_fuentes",
    ))
  ) {
    return { kind: "unauthorized" };
  }

  const usage = {
    feature: "asistente" as const,
    spaceId: input.spaceId,
    profileId: input.identityId,
  };
  const embedder =
    dependencies.embedder && dependencies.meter
      ? dependencies.meter.embedder(dependencies.embedder, usage)
      : dependencies.embedder;
  const chatModel =
    dependencies.chatModel && dependencies.meter
      ? dependencies.meter.chat(dependencies.chatModel, usage)
      : dependencies.chatModel;
  const startedAt = Date.now();
  const lexical = await dependencies.knowledgeRepository.searchLexical(
    input.spaceId,
    question,
    assistantLimits.lexicalCandidates,
  );
  let semantic: typeof lexical | null = null;
  if (embedder) {
    try {
      // A blocked embedding (limit reached) only skips the semantic search.
      const [values] = await embedder.embed([question]);
      semantic = await dependencies.knowledgeRepository.searchSemantic(
        input.spaceId,
        { model: embedder.model, values },
        assistantLimits.semanticCandidates,
      );
    } catch {
      semantic = null;
    }
  }
  const retrieval = {
    lexical: lexical.length,
    semantic: semantic?.length ?? null,
  };
  const fragments = prepareFragments(
    mergeCandidates(semantic ? [lexical, semantic] : [lexical]),
  );
  const finish = (result: AssistantResult, usage?: unknown) => {
    dependencies.log?.({
      event: "assistant_query",
      spaceId: input.spaceId,
      outcome: result.kind,
      fragments: fragments.length,
      ...retrieval,
      usage,
      durationMs: Date.now() - startedAt,
    });
    return result;
  };

  if (fragments.length === 0) {
    return finish({ kind: "insufficient", fragments, retrieval });
  }
  if (!chatModel) {
    return finish({ kind: "retrieval_only", fragments, retrieval });
  }

  let completion;
  try {
    completion = await chatModel.complete({
      ...buildAssistantPrompt(question, fragments),
      maxOutputTokens: assistantLimits.maxOutputTokens,
    });
  } catch (error) {
    if (error instanceof AiBudgetExceededError) {
      return finish({
        kind: "budget_exceeded",
        limit: error.limit,
        fragments,
        retrieval,
      });
    }
    return finish({ kind: "model_error", fragments, retrieval });
  }

  const parsed = parseModelAnswer(
    completion.text,
    fragments.map((fragment) => fragment.ref),
  );
  if (parsed.kind !== "answered") {
    return finish(
      { kind: parsed.kind, fragments, retrieval },
      completion.usage,
    );
  }
  return finish(
    {
      kind: "answered",
      answer: parsed.answer,
      citations: toCitations(parsed.refs, fragments),
      fragments,
      retrieval,
    },
    completion.usage,
  );
}

/**
 * Embeds segments of current versions that have no vector for the configured
 * model yet. Bounded per call so a sweep cannot run up unbounded requests.
 */
/**
 * Embeds segments of current versions that have no vector for the configured
 * model yet. Bounded per call so a sweep cannot run up unbounded requests.
 * Batches never mix spaces, so each one is charged to its space; a reached
 * limit stops the pass with AiBudgetExceededError and leaves the rest pending.
 */
export async function indexPendingEmbeddings(
  dependencies: {
    knowledgeRepository: KnowledgeRepository;
    embedder: TextEmbedder;
    meter?: AiMeter;
  },
  options: { maxSegments: number; versionIds?: string[] },
): Promise<number> {
  const pending =
    await dependencies.knowledgeRepository.listSegmentsMissingEmbeddings(
      dependencies.embedder.model,
      options.maxSegments,
      options.versionIds,
    );
  const bySpace = new Map<string, typeof pending>();
  for (const segment of pending) {
    bySpace.set(segment.spaceId, [
      ...(bySpace.get(segment.spaceId) ?? []),
      segment,
    ]);
  }
  let saved = 0;
  for (const [spaceId, segments] of bySpace) {
    const embedder = dependencies.meter
      ? dependencies.meter.embedder(dependencies.embedder, {
          feature: "indexacion",
          spaceId,
          profileId: null,
        })
      : dependencies.embedder;
    for (
      let start = 0;
      start < segments.length;
      start += assistantLimits.embeddingBatchSize
    ) {
      const batch = segments.slice(
        start,
        start + assistantLimits.embeddingBatchSize,
      );
      const vectors = await embedder.embed(
        batch.map((segment) =>
          segment.content.slice(0, assistantLimits.embeddingInputMaxChars),
        ),
      );
      saved += await dependencies.knowledgeRepository.saveEmbeddings(
        dependencies.embedder.model,
        batch.map((segment, index) => ({
          versionId: segment.versionId,
          ordinal: segment.ordinal,
          values: vectors[index],
        })),
      );
    }
  }
  return saved;
}
