import type { RouteCitation, StepCode } from "../routes/contract.ts";

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
  code: StepCode | null;
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

export type TeamMemberProgress = {
  profileId: string;
  email: string | null;
  role: "responsable" | "integrante";
  /** "no_empezada" only means there is no recorded progress. */
  state: "no_empezada" | "en_progreso" | "completada";
  resolvedSteps: number;
  correctSteps: number;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type TeamProgress = {
  routeId: string;
  title: string;
  totalSteps: number;
  activeMembers: number;
  started: number;
  completed: number;
  members: TeamMemberProgress[];
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
  /**
   * Active members of the space with their progress on this published
   * version only; revoked members are excluded (their progress is kept).
   */
  listTeamProgress(input: {
    spaceId: string;
    routeId: string;
    publishedAt: Date;
  }): Promise<{
    members: {
      profileId: string;
      email: string | null;
      role: "responsable" | "integrante";
      startedAt: Date | null;
      completedAt: Date | null;
    }[];
    attempts: (AttemptRecord & { profileId: string })[];
  }>;
  recordAnswer(input: {
    identityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    selectedOption: number;
    submissionId: string;
  }): Promise<AnswerResult>;
}
