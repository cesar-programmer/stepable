import { z } from "zod";

import { authorizeSpaceAction } from "../access/authorization.ts";
import type { AccessRepository } from "../access/contract.ts";
import type { RouteRepository } from "../routes/contract.ts";

import type {
  AnswerResult,
  LearnerView,
  LearningRepository,
  StartResult,
} from "./contract.ts";
import { deriveProgress, isResolved } from "./rules.ts";

type Dependencies = {
  accessRepository: AccessRepository;
  routeRepository: RouteRepository;
  learningRepository: LearningRepository;
};

async function canRead(
  dependencies: Dependencies,
  identityId: string,
  spaceId: string,
) {
  return Boolean(
    await authorizeSpaceAction(
      dependencies.accessRepository,
      identityId,
      spaceId,
      "consultar_rutas",
    ),
  );
}

export async function startRoute(
  dependencies: Dependencies,
  input: { identityId: string; spaceId: string; routeId: string },
): Promise<StartResult> {
  if (!(await canRead(dependencies, input.identityId, input.spaceId))) {
    return { kind: "unauthorized" };
  }
  return dependencies.learningRepository.startProgress(input);
}

/**
 * The learner's own view of a published route. Membership is revalidated on
 * every read; the answer key is only included for resolved steps.
 */
export async function readLearnerView(
  dependencies: Dependencies,
  input: { identityId: string; spaceId: string; routeId: string },
): Promise<LearnerView | null> {
  if (!(await canRead(dependencies, input.identityId, input.spaceId))) {
    return null;
  }
  const route = await dependencies.routeRepository.findRoute(
    input.spaceId,
    input.routeId,
    true,
  );
  if (!route) return null;
  const progress = await dependencies.learningRepository.loadProgress(
    input.identityId,
    input.routeId,
  );
  const derived = deriveProgress(
    route.steps.map((step) => step.id),
    progress?.attempts ?? [],
  );

  return {
    routeId: route.id,
    title: route.title ?? "Ruta",
    objective: route.objective,
    needsReview: route.needsReview,
    started: progress !== null,
    completed: progress !== null && derived.completed,
    totalSteps: route.steps.length,
    resolvedSteps: derived.resolvedSteps,
    correctSteps: derived.correctSteps,
    steps: route.steps.map((step, index) => {
      const state = progress ? derived.steps[index] : null;
      const visible = state !== null && state.state !== "bloqueado";
      const resolved = state !== null && isResolved(state.state);
      return {
        id: step.id,
        position: step.position,
        title: step.title,
        state: state?.state ?? "bloqueado",
        attemptsUsed: state?.attemptsUsed ?? 0,
        attemptsLeft: state?.attemptsLeft ?? 0,
        selectedOptions: state?.selectedOptions ?? [],
        lesson: visible ? step.lesson : null,
        question: visible ? step.question : null,
        options: visible ? step.options : null,
        citations: visible ? step.citations : [],
        correctOption: resolved ? step.correctOption : null,
        explanation: resolved ? step.explanation : null,
      };
    }),
  };
}

const answerSchema = z.object({
  stepId: z.uuid(),
  selectedOption: z.number().int().min(0).max(3),
  submissionId: z.uuid(),
});

/** Graded on the server; a repeated submission returns the stored result. */
export async function answerStep(
  dependencies: Dependencies,
  input: {
    identityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    selectedOption: number;
    submissionId: string;
  },
): Promise<AnswerResult> {
  if (!answerSchema.safeParse(input).success) return { kind: "invalid" };
  if (!(await canRead(dependencies, input.identityId, input.spaceId))) {
    return { kind: "unauthorized" };
  }
  return dependencies.learningRepository.recordAnswer(input);
}
