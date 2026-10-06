import { z } from "zod";

import { authorizeSpaceAction } from "../access/authorization.ts";
import type { AccessRepository } from "../access/contract.ts";
import { routeLimits, type RouteRepository } from "../routes/contract.ts";

import type {
  AnswerResult,
  LearnerView,
  LearningRepository,
  StartResult,
  TeamProgress,
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
        writtenAnswers: state?.writtenAnswers ?? [],
        lesson: visible ? step.lesson : null,
        question: visible ? step.question : null,
        activityType: step.activityType,
        code: visible ? step.code : null,
        options: visible ? step.options : null,
        citations: visible ? step.citations : [],
        correctOption: resolved ? step.correctOption : null,
        acceptedAnswers: resolved ? step.acceptedAnswers : null,
        explanation: resolved ? step.explanation : null,
      };
    }),
  };
}

// Exactly one response: an option for multiple choice or a written answer.
const answerSchema = z
  .object({
    stepId: z.uuid(),
    selectedOption: z.number().int().min(0).max(3).nullable(),
    answerText: z
      .string()
      .trim()
      .min(1)
      .max(routeLimits.answerMaxChars)
      .nullable(),
    submissionId: z.uuid(),
  })
  .refine(
    (input) => (input.selectedOption === null) !== (input.answerText === null),
  );

/** Graded on the server; a repeated submission returns the stored result. */
export async function answerStep(
  dependencies: Dependencies,
  input: {
    identityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    selectedOption?: number | null;
    answerText?: string | null;
    submissionId: string;
  },
): Promise<AnswerResult> {
  const parsed = answerSchema.safeParse({
    ...input,
    selectedOption: input.selectedOption ?? null,
    answerText: input.answerText ?? null,
  });
  if (!parsed.success) return { kind: "invalid" };
  if (!(await canRead(dependencies, input.identityId, input.spaceId))) {
    return { kind: "unauthorized" };
  }
  return dependencies.learningRepository.recordAnswer({
    ...input,
    selectedOption: parsed.data.selectedOption,
    answerText: parsed.data.answerText,
  });
}

/**
 * Read-only team view of a published route for active responsibles. Totals
 * use the same rules as the learner view; completing is not mastery.
 */
export async function readTeamProgress(
  dependencies: Dependencies,
  input: { identityId: string; spaceId: string; routeId: string },
): Promise<TeamProgress | null> {
  if (
    !(await authorizeSpaceAction(
      dependencies.accessRepository,
      input.identityId,
      input.spaceId,
      "consultar_progreso_equipo",
    ))
  ) {
    return null;
  }
  const route = await dependencies.routeRepository.findRoute(
    input.spaceId,
    input.routeId,
    true,
  );
  if (!route?.publishedAt) return null;

  const team = await dependencies.learningRepository.listTeamProgress({
    spaceId: input.spaceId,
    routeId: input.routeId,
    publishedAt: route.publishedAt,
  });
  const stepIds = route.steps.map((step) => step.id);
  const members = team.members.map((member) => {
    const derived = deriveProgress(
      stepIds,
      team.attempts.filter((attempt) => attempt.profileId === member.profileId),
    );
    const started = member.startedAt !== null;
    return {
      ...member,
      state: !started
        ? ("no_empezada" as const)
        : derived.completed
          ? ("completada" as const)
          : ("en_progreso" as const),
      resolvedSteps: started ? derived.resolvedSteps : 0,
      correctSteps: started ? derived.correctSteps : 0,
    };
  });
  return {
    routeId: route.id,
    title: route.title ?? "Ruta",
    totalSteps: stepIds.length,
    activeMembers: members.length,
    started: members.filter((member) => member.state !== "no_empezada").length,
    completed: members.filter((member) => member.state === "completada").length,
    members,
  };
}
