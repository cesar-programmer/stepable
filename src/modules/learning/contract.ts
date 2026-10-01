import type { RouteCitation } from "../routes/contract.ts";

import type { AttemptRecord, StepLearningState } from "./rules.ts";

/**
 * What a learner may see of a step. Locked steps only show their title; the
 * answer key (correct option and explanation) is present only once resolved.
 */
export type LearnerStep = {
  id: string;
  position: number;
  title: string;
  state: StepLearningState;
  attemptsUsed: number;
  attemptsLeft: number;
  selectedOptions: number[];
  lesson: string | null;
  question: string | null;
  options: string[] | null;
  citations: RouteCitation[];
  correctOption: number | null;
  explanation: string | null;
};

export type LearnerView = {
  routeId: string;
  title: string;
  objective: string;
  needsReview: boolean;
  started: boolean;
  completed: boolean;
  totalSteps: number;
  resolvedSteps: number;
  correctSteps: number;
  steps: LearnerStep[];
};

export type StartResult = {
  kind: "started" | "already_started" | "unauthorized" | "not_found";
};

export type AnswerResult =
  | {
      kind: "recorded";
      stepId: string;
      correct: boolean;
      resolved: boolean;
      attemptsLeft: number;
      completed: boolean;
      repeated: boolean;
    }
  | {
      kind:
        | "unauthorized"
        | "not_found"
        | "not_started"
        | "not_current"
        | "already_resolved"
        | "invalid";
    };

export interface LearningRepository {
  startProgress(input: {
    identityId: string;
    spaceId: string;
    routeId: string;
  }): Promise<StartResult>;
  /** Only the caller's own progress; never another member's. */
  loadProgress(
    identityId: string,
    routeId: string,
  ): Promise<{ startedAt: Date; attempts: AttemptRecord[] } | null>;
  recordAnswer(input: {
    identityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    selectedOption: number;
    submissionId: string;
  }): Promise<AnswerResult>;
}
