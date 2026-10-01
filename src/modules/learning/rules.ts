export const maxAttemptsPerStep = 3;

/**
 * - acertado: answered correctly within the allowed attempts.
 * - resuelto_sin_acertar: attempts exhausted without a correct answer.
 * - actual: the first unresolved step (steps unlock in order).
 * - bloqueado: after the current step.
 * A step is "resolved" when acertado or resuelto_sin_acertar.
 */
export type StepLearningState =
  "acertado" | "resuelto_sin_acertar" | "actual" | "bloqueado";

export type AttemptRecord = {
  stepId: string;
  attemptNumber: number;
  selectedOption: number;
  correct: boolean;
};

export type StepProgress = {
  stepId: string;
  state: StepLearningState;
  attemptsUsed: number;
  attemptsLeft: number;
  selectedOptions: number[];
};

export type DerivedProgress = {
  steps: StepProgress[];
  currentStepId: string | null;
  resolvedSteps: number;
  correctSteps: number;
  /** All steps resolved; says nothing about mastery of the content. */
  completed: boolean;
};

export function isResolved(state: StepLearningState): boolean {
  return state === "acertado" || state === "resuelto_sin_acertar";
}

/** `stepIds` must be ordered by position. */
export function deriveProgress(
  stepIds: string[],
  attempts: AttemptRecord[],
): DerivedProgress {
  let currentStepId: string | null = null;
  const steps = stepIds.map((stepId): StepProgress => {
    const own = attempts
      .filter((attempt) => attempt.stepId === stepId)
      .sort((left, right) => left.attemptNumber - right.attemptNumber);
    const attemptsUsed = own.length;
    let state: StepLearningState;
    if (own.some((attempt) => attempt.correct)) {
      state = "acertado";
    } else if (attemptsUsed >= maxAttemptsPerStep) {
      state = "resuelto_sin_acertar";
    } else if (currentStepId === null) {
      state = "actual";
      currentStepId = stepId;
    } else {
      state = "bloqueado";
    }
    return {
      stepId,
      state,
      attemptsUsed,
      attemptsLeft: isResolved(state) ? 0 : maxAttemptsPerStep - attemptsUsed,
      selectedOptions: own.map((attempt) => attempt.selectedOption),
    };
  });
  const resolvedSteps = steps.filter((step) => isResolved(step.state)).length;
  return {
    steps,
    currentStepId,
    resolvedSteps,
    correctSteps: steps.filter((step) => step.state === "acertado").length,
    completed: stepIds.length > 0 && resolvedSteps === stepIds.length,
  };
}
