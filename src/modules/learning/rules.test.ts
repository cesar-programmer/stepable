import { describe, expect, it } from "vitest";

import { deriveProgress, type AttemptRecord } from "./rules.ts";

const attempt = (
  stepId: string,
  attemptNumber: number,
  correct: boolean,
): AttemptRecord => ({ stepId, attemptNumber, selectedOption: 0, correct });

describe("learning progress rules", () => {
  it("unlocks steps in order and keeps later steps blocked", () => {
    const progress = deriveProgress(["a", "b", "c"], [attempt("a", 1, false)]);
    expect(progress.steps.map((step) => step.state)).toEqual([
      "actual",
      "bloqueado",
      "bloqueado",
    ]);
    expect(progress.steps[0].attemptsLeft).toBe(2);
    expect(progress.currentStepId).toBe("a");
  });

  it("distinguishes resolved from answered correctly and counts steps, not submissions", () => {
    const progress = deriveProgress(
      ["a", "b", "c"],
      [
        attempt("a", 1, false),
        attempt("a", 2, false),
        attempt("a", 3, false),
        attempt("b", 1, false),
        attempt("b", 2, true),
      ],
    );
    expect(progress.steps.map((step) => step.state)).toEqual([
      "resuelto_sin_acertar",
      "acertado",
      "actual",
    ]);
    expect(progress).toMatchObject({
      resolvedSteps: 2,
      correctSteps: 1,
      completed: false,
    });
  });

  it("completes when every step is resolved, even without mastery", () => {
    const progress = deriveProgress(
      ["a", "b"],
      [
        attempt("a", 1, true),
        attempt("b", 1, false),
        attempt("b", 2, false),
        attempt("b", 3, false),
      ],
    );
    expect(progress).toMatchObject({
      completed: true,
      resolvedSteps: 2,
      correctSteps: 1,
      currentStepId: null,
    });
  });
});
