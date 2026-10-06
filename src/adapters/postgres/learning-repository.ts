import { sql, type SQL } from "drizzle-orm";

import { allowsSpaceAction } from "../../modules/access/authorization.ts";
import type {
  AnswerResult,
  LearningRepository,
  StartResult,
} from "../../modules/learning/contract.ts";
import {
  deriveProgress,
  isAcceptedAnswer,
  isResolved,
  type AttemptRecord,
} from "../../modules/learning/rules.ts";
import type { ActivityType } from "../../modules/routes/contract.ts";

import type { StepableDatabase } from "./database.ts";

type Transaction = Parameters<
  Parameters<StepableDatabase["transaction"]>[0]
>[0];
type Executor = Pick<Transaction, "execute">;

async function rows<T>(executor: Executor, query: SQL): Promise<T[]> {
  return (await executor.execute(query)) as unknown as T[];
}

type AttemptRow = {
  step_id: string;
  attempt_number: number;
  selected_option: number | null;
  answer_text: string | null;
  correct: boolean;
};

const toAttempt = (row: AttemptRow): AttemptRecord => ({
  stepId: row.step_id,
  attemptNumber: row.attempt_number,
  selectedOption: row.selected_option,
  answerText: row.answer_text,
  correct: row.correct,
});

// Membership is revalidated inside every write transaction.
async function canRead(
  executor: Executor,
  identityId: string,
  spaceId: string,
): Promise<boolean> {
  const [member] = await rows<{ role: string; status: string }>(
    executor,
    sql`select role, status from public.memberships
        where space_id = ${spaceId} and profile_id = ${identityId}`,
  );
  return Boolean(
    member && allowsSpaceAction(member.status, member.role, "consultar_rutas"),
  );
}

export class PostgresLearningRepository implements LearningRepository {
  private readonly database: StepableDatabase;

  constructor(database: StepableDatabase) {
    this.database = database;
  }

  async startProgress(input: {
    identityId: string;
    spaceId: string;
    routeId: string;
  }): Promise<StartResult> {
    return this.database.transaction(async (transaction) => {
      if (!(await canRead(transaction, input.identityId, input.spaceId))) {
        return { kind: "unauthorized" as const };
      }
      const [route] = await rows<{ published_at: Date }>(
        transaction,
        sql`select published_at from public.routes
            where id = ${input.routeId} and space_id = ${input.spaceId}
              and status = 'publicada'`,
      );
      if (!route) return { kind: "not_found" as const };
      const inserted = await rows<{ route_id: string }>(
        transaction,
        sql`insert into public.route_progress
              (route_id, space_id, profile_id, route_published_at)
            values (${input.routeId}, ${input.spaceId}, ${input.identityId},
              ${new Date(route.published_at).toISOString()}::timestamptz)
            on conflict (route_id, profile_id) do nothing
            returning route_id`,
      );
      return {
        kind:
          inserted.length > 0
            ? ("started" as const)
            : ("already_started" as const),
      };
    });
  }

  async loadProgress(identityId: string, routeId: string) {
    const [progress] = await rows<{ started_at: Date }>(
      this.database,
      sql`select started_at from public.route_progress
          where route_id = ${routeId} and profile_id = ${identityId}`,
    );
    if (!progress) return null;
    const attempts = await rows<AttemptRow>(
      this.database,
      sql`select step_id, attempt_number, selected_option, answer_text, correct
          from public.route_step_attempts
          where route_id = ${routeId} and profile_id = ${identityId}`,
    );
    return {
      startedAt: new Date(progress.started_at),
      attempts: attempts.map(toAttempt),
    };
  }

  async listTeamProgress(input: {
    spaceId: string;
    routeId: string;
    publishedAt: Date;
  }) {
    // Progress belongs to one published version; JavaScript dates carry
    // milliseconds while PostgreSQL keeps microseconds.
    const publishedAt = input.publishedAt.toISOString();
    const members = await rows<{
      profile_id: string;
      email: string | null;
      role: "responsable" | "integrante";
      started_at: Date | null;
      completed_at: Date | null;
    }>(
      this.database,
      sql`select member.profile_id, account.email, member.role,
            progress.started_at, progress.completed_at
          from public.memberships member
          join auth.users account on account.id = member.profile_id
          left join public.route_progress progress
            on progress.route_id = ${input.routeId}
            and progress.profile_id = member.profile_id
            and date_trunc('milliseconds', progress.route_published_at)
              = date_trunc('milliseconds', ${publishedAt}::timestamptz)
          where member.space_id = ${input.spaceId}
            and member.status = 'activa'
          order by lower(coalesce(account.email, '')), member.profile_id`,
    );
    const attempts = await rows<AttemptRow & { profile_id: string }>(
      this.database,
      sql`select attempt.profile_id, attempt.step_id, attempt.attempt_number,
            attempt.selected_option, attempt.answer_text, attempt.correct
          from public.route_step_attempts attempt
          join public.route_progress progress
            on progress.route_id = attempt.route_id
            and progress.profile_id = attempt.profile_id
          join public.memberships member
            on member.space_id = ${input.spaceId}
            and member.profile_id = attempt.profile_id
            and member.status = 'activa'
          where attempt.route_id = ${input.routeId}
            and date_trunc('milliseconds', progress.route_published_at)
              = date_trunc('milliseconds', ${publishedAt}::timestamptz)`,
    );
    return {
      members: members.map((member) => ({
        profileId: member.profile_id,
        email: member.email,
        role: member.role,
        startedAt: member.started_at ? new Date(member.started_at) : null,
        completedAt: member.completed_at ? new Date(member.completed_at) : null,
      })),
      attempts: attempts.map((attempt) => ({
        ...toAttempt(attempt),
        profileId: attempt.profile_id,
      })),
    };
  }

  async recordAnswer(input: {
    identityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    selectedOption: number | null;
    answerText: string | null;
    submissionId: string;
  }): Promise<AnswerResult> {
    return this.database.transaction(async (transaction) => {
      if (!(await canRead(transaction, input.identityId, input.spaceId))) {
        return { kind: "unauthorized" as const };
      }
      const [route] = await rows<{ id: string }>(
        transaction,
        sql`select id from public.routes
            where id = ${input.routeId} and space_id = ${input.spaceId}
              and status = 'publicada'`,
      );
      if (!route) return { kind: "not_found" as const };
      // Serializes the member's answers on this route.
      const [progress] = await rows<{ completed_at: Date | null }>(
        transaction,
        sql`select completed_at from public.route_progress
            where route_id = ${input.routeId} and profile_id = ${input.identityId}
            for update`,
      );
      if (!progress) return { kind: "not_started" as const };

      const steps = await rows<{
        id: string;
        activity_type: ActivityType;
        options: string[];
        correct_option: number | null;
        accepted_answers: string[] | null;
      }>(
        transaction,
        sql`select id, activity_type, options, correct_option, accepted_answers
            from public.route_steps
            where route_id = ${input.routeId} order by position`,
      );
      const loadAttempts = async () =>
        (
          await rows<AttemptRow>(
            transaction,
            sql`select step_id, attempt_number, selected_option, answer_text, correct
                from public.route_step_attempts
                where route_id = ${input.routeId}
                  and profile_id = ${input.identityId}`,
          )
        ).map(toAttempt);
      const summarize = (
        attempts: AttemptRecord[],
        correct: boolean,
        repeated: boolean,
      ): AnswerResult => {
        const derived = deriveProgress(
          steps.map((step) => step.id),
          attempts,
        );
        const step = derived.steps.find(
          (item) => item.stepId === input.stepId,
        )!;
        return {
          kind: "recorded",
          stepId: input.stepId,
          correct,
          resolved: isResolved(step.state),
          attemptsLeft: step.attemptsLeft,
          completed: derived.completed,
          repeated,
        };
      };

      // A repeated submission (double click, resend) returns its result.
      const [previous] = await rows<{
        step_id: string;
        profile_id: string;
        correct: boolean;
      }>(
        transaction,
        sql`select step_id, profile_id, correct from public.route_step_attempts
            where submission_id = ${input.submissionId}`,
      );
      if (previous) {
        if (
          previous.profile_id !== input.identityId ||
          previous.step_id !== input.stepId
        ) {
          return { kind: "invalid" as const };
        }
        return summarize(await loadAttempts(), previous.correct, true);
      }

      const step = steps.find((item) => item.id === input.stepId);
      // The response must match the activity of the step.
      const fillIn = step?.activity_type === "completar";
      if (
        !step ||
        (fillIn
          ? input.answerText === null
          : input.selectedOption === null ||
            input.selectedOption >= step.options.length)
      ) {
        return { kind: "invalid" as const };
      }
      const attempts = await loadAttempts();
      const derived = deriveProgress(
        steps.map((item) => item.id),
        attempts,
      );
      const current = derived.steps.find((item) => item.stepId === step.id)!;
      if (isResolved(current.state)) {
        return { kind: "already_resolved" as const };
      }
      if (derived.currentStepId !== step.id) {
        return { kind: "not_current" as const };
      }

      const answerText = fillIn ? (input.answerText ?? "").trim() : null;
      const selectedOption = fillIn ? null : input.selectedOption;
      const correct = fillIn
        ? isAcceptedAnswer(answerText ?? "", step.accepted_answers ?? [])
        : selectedOption === step.correct_option;
      await transaction.execute(
        sql`insert into public.route_step_attempts
              (route_id, profile_id, step_id, attempt_number, selected_option,
               answer_text, correct, submission_id)
            values (${input.routeId}, ${input.identityId}, ${step.id},
              ${current.attemptsUsed + 1}, ${selectedOption}, ${answerText},
              ${correct}, ${input.submissionId})`,
      );
      const updated = await loadAttempts();
      const result = summarize(updated, correct, false);
      if (
        result.kind === "recorded" &&
        result.completed &&
        !progress.completed_at
      ) {
        await transaction.execute(
          sql`update public.route_progress set completed_at = now()
              where route_id = ${input.routeId}
                and profile_id = ${input.identityId}`,
        );
      }
      return result;
    });
  }
}
