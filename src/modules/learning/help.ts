import { z } from "zod";

import { authorizeSpaceAction } from "../access/authorization.ts";
import type { AccessRepository } from "../access/contract.ts";
import { parseModelAnswer } from "../knowledge/answer.ts";
import {
  assistantLimits,
  type ChatModel,
  type Citation,
  type FragmentCandidate,
  type KnowledgeRepository,
  type RetrievedFragment,
  type TextEmbedder,
} from "../knowledge/contract.ts";
import { mergeCandidates, prepareFragments } from "../knowledge/retrieval.ts";
import { toCitations } from "../knowledge/service.ts";
import type { RouteRepository } from "../routes/contract.ts";

import type { LearningRepository } from "./contract.ts";
import {
  buildStepHelpPrompt,
  stepCodeMarker,
  type StepHelpContext,
  type StepHelpMode,
} from "./help-prompt.ts";
import { deriveProgress, isResolved } from "./rules.ts";

export type StepHelpDependencies = {
  accessRepository: AccessRepository;
  routeRepository: RouteRepository;
  learningRepository: LearningRepository;
  knowledgeRepository: KnowledgeRepository;
  chatModel: ChatModel | null;
  embedder: TextEmbedder | null;
  log?: (entry: Record<string, unknown>) => void;
};

export type StepHelpCitation = Citation & { fromStepSources: boolean };

export type StepHelpResult =
  | {
      kind: "answered";
      mode: StepHelpMode;
      sourcesChanged: boolean;
      answer: string;
      citations: StepHelpCitation[];
      /** The answer relies on the step's own visible code. */
      citesStepCode: boolean;
      fragments: RetrievedFragment[];
    }
  | {
      kind: "insufficient" | "retrieval_only" | "unverifiable" | "model_error";
      mode: StepHelpMode;
      sourcesChanged: boolean;
      fragments: RetrievedFragment[];
    }
  | {
      kind:
        | "unauthorized"
        | "not_found"
        | "not_started"
        | "locked"
        | "invalid_question";
    };

const idsSchema = z.object({
  spaceId: z.uuid(),
  routeId: z.uuid(),
  stepId: z.uuid(),
});

const defaultQuestions: Record<StepHelpMode, string> = {
  pistas: "Explícame los conceptos de este paso y dame una pista.",
  explicacion: "Explícame la respuesta de este paso.",
};

/** Step sources first; the rest of the space only fills the remaining room. */
function prioritize(
  stepCandidates: FragmentCandidate[],
  spaceCandidates: FragmentCandidate[],
): FragmentCandidate[] {
  const seen = new Set(
    stepCandidates.map(
      (candidate) => `${candidate.versionId}:${candidate.ordinal}`,
    ),
  );
  return [
    ...stepCandidates,
    ...spaceCandidates.filter(
      (candidate) => !seen.has(`${candidate.versionId}:${candidate.ordinal}`),
    ),
  ].slice(0, assistantLimits.fragments);
}

/**
 * Contextual help for a visible step of the caller's own route. The step, its
 * state and the permissions are read on the server; until the step is
 * resolved the answer key is never part of the prompt. It never writes
 * progress or attempts.
 */
export async function askStepHelp(
  dependencies: StepHelpDependencies,
  input: {
    identityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    question: string;
  },
): Promise<StepHelpResult> {
  if (!idsSchema.safeParse(input).success) return { kind: "not_found" };
  const asked = input.question.replace(/\s+/g, " ").trim();
  if (
    asked.length > assistantLimits.questionMaxChars ||
    (asked.length > 0 && asked.length < assistantLimits.questionMinChars)
  ) {
    return { kind: "invalid_question" };
  }
  for (const action of ["consultar_rutas", "consultar_fuentes"] as const) {
    if (
      !(await authorizeSpaceAction(
        dependencies.accessRepository,
        input.identityId,
        input.spaceId,
        action,
      ))
    ) {
      return { kind: "unauthorized" };
    }
  }

  const route = await dependencies.routeRepository.findRoute(
    input.spaceId,
    input.routeId,
    true,
  );
  const index = route?.steps.findIndex((step) => step.id === input.stepId);
  if (!route || index === undefined || index < 0) return { kind: "not_found" };
  const step = route.steps[index];
  const progress = await dependencies.learningRepository.loadProgress(
    input.identityId,
    input.routeId,
  );
  if (!progress) return { kind: "not_started" };
  const state = deriveProgress(
    route.steps.map((item) => item.id),
    progress.attempts,
  ).steps[index];
  if (state.state === "bloqueado") return { kind: "locked" };

  const sourcesChanged = step.citations.some(
    (citation) => citation.state !== "vigente",
  );
  const resolved =
    isResolved(state.state) &&
    step.correctOption !== null &&
    step.explanation !== null;
  const base = {
    title: step.title,
    lesson: step.lesson,
    question: step.question,
    code: step.code,
    options: step.options,
    sourcesChanged,
  };
  const context: StepHelpContext = resolved
    ? {
        ...base,
        mode: "explicacion",
        correctOption: step.correctOption as number,
        explanation: step.explanation as string,
        selectedOptions: state.selectedOptions,
      }
    : { ...base, mode: "pistas" };
  const mode = context.mode;
  const question = asked || defaultQuestions[mode];

  // Deleted sources are not searched; a changed source is searched in its
  // current version only, and the prompt says the lesson may not match it.
  const stepSourceIds = [
    ...new Set(
      step.citations
        .filter((citation) => citation.state !== "fuente_eliminada")
        .map((citation) => citation.sourceId),
    ),
  ];
  const searchText = `${question} ${step.title} ${step.question}`.slice(
    0,
    assistantLimits.questionMaxChars * 2,
  );
  const startedAt = Date.now();
  let vector: number[] | null = null;
  if (dependencies.embedder) {
    try {
      [vector] = await dependencies.embedder.embed([searchText]);
    } catch {
      vector = null;
    }
  }
  const search = async (sourceIds?: string[]) => {
    const lexical = await dependencies.knowledgeRepository.searchLexical(
      input.spaceId,
      searchText,
      assistantLimits.lexicalCandidates,
      sourceIds,
    );
    const semantic =
      vector && dependencies.embedder
        ? await dependencies.knowledgeRepository
            .searchSemantic(
              input.spaceId,
              { model: dependencies.embedder.model, values: vector },
              assistantLimits.semanticCandidates,
              sourceIds,
            )
            .catch(() => null)
        : null;
    return mergeCandidates(semantic ? [lexical, semantic] : [lexical]);
  };
  const fragments = prepareFragments(
    prioritize(await search(stepSourceIds), await search()),
  );
  const fromStep = new Set(stepSourceIds);

  const finish = (result: StepHelpResult, usage?: unknown) => {
    dependencies.log?.({
      event: "step_help",
      spaceId: input.spaceId,
      routeId: input.routeId,
      mode,
      outcome: result.kind,
      fragments: fragments.length,
      stepFragments: fragments.filter((fragment) =>
        fromStep.has(fragment.sourceId),
      ).length,
      usage,
      durationMs: Date.now() - startedAt,
    });
    return result;
  };
  const shared = { mode, sourcesChanged, fragments };

  // The step's own code is evidence of what it does, so it can still be
  // explained without fragments; company practices still need fragments.
  if (fragments.length === 0 && !step.code) {
    return finish({ kind: "insufficient", ...shared });
  }
  if (!dependencies.chatModel) {
    return finish({ kind: "retrieval_only", ...shared });
  }
  let completion;
  try {
    completion = await dependencies.chatModel.complete({
      ...buildStepHelpPrompt(context, question, fragments),
      maxOutputTokens: assistantLimits.maxOutputTokens,
    });
  } catch {
    return finish({ kind: "model_error", ...shared });
  }
  const parsed = parseModelAnswer(
    completion.text,
    fragments.map((fragment) => fragment.ref),
    step.code ? { marker: stepCodeMarker } : undefined,
  );
  if (parsed.kind !== "answered") {
    return finish({ kind: parsed.kind, ...shared }, completion.usage);
  }
  return finish(
    {
      kind: "answered",
      ...shared,
      answer: parsed.answer,
      citations: toCitations(parsed.refs, fragments).map((citation) => ({
        ...citation,
        fromStepSources: fromStep.has(citation.sourceId),
      })),
      citesStepCode: parsed.citesLocal,
    },
    completion.usage,
  );
}
