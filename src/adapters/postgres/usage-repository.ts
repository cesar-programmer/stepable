import { sql, type SQL } from "drizzle-orm";

import type {
  ReserveResult,
  UsageContext,
  UsageLimits,
  UsageRepository,
  UsageSummary,
  AiCallKind,
} from "../../modules/usage/contract.ts";

import type { StepableDatabase } from "./database.ts";

type Executor = Pick<StepableDatabase, "execute">;

async function rows<T>(executor: Executor, query: SQL): Promise<T[]> {
  return (await executor.execute(query)) as unknown as T[];
}

const todayUtc = sql`date_trunc('day', now(), 'UTC')`;
const queryFeatures = ["asistente", "ayuda"];

async function ensureBudget(executor: Executor, namespace: string) {
  await executor.execute(
    sql`insert into public.ai_budgets (namespace) values (${namespace})
        on conflict (namespace) do nothing`,
  );
}

export class PostgresUsageRepository implements UsageRepository {
  private readonly database: StepableDatabase;

  constructor(database: StepableDatabase) {
    this.database = database;
  }

  reserve(input: {
    namespace: string;
    context: UsageContext;
    kind: AiCallKind;
    pricingKey: string;
    reserveMicroUsd: number;
    limits: UsageLimits;
  }): Promise<ReserveResult> {
    const { context, limits, namespace } = input;
    return this.database.transaction(async (transaction) => {
      // Serializes reservations of the namespace: concurrent requests cannot
      // both pass a check that only one of them fits.
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`ai_usage:${namespace}`}))`,
      );
      await ensureBudget(transaction, namespace);
      const [totals] = await rows<{
        global_used: string;
        space_today: string;
        user_queries: number;
      }>(
        transaction,
        sql`select
          coalesce(sum(cost_micro_usd), 0) as global_used,
          coalesce(sum(cost_micro_usd) filter (
            where space_id = ${context.spaceId}::uuid
              and created_at >= ${todayUtc}), 0) as space_today,
          count(*) filter (
            where profile_id = ${context.profileId}::uuid
              and kind = 'conversacion'
              and feature in ('asistente', 'ayuda')
              and status <> 'liberada'
              and created_at >= ${todayUtc})::int as user_queries
          from public.ai_usage where namespace = ${namespace}`,
      );
      const exceeds = (used: number, limit: number) =>
        used >= limit || used + input.reserveMicroUsd > limit;
      if (exceeds(Number(totals.global_used), limits.globalMicroUsd)) {
        return { kind: "blocked" as const, limit: "global" as const };
      }
      if (
        context.spaceId &&
        exceeds(Number(totals.space_today), limits.spaceDailyMicroUsd)
      ) {
        return { kind: "blocked" as const, limit: "espacio" as const };
      }
      // Queries are counted by their conversation call; the question's
      // embedding is blocked too once the user has no queries left.
      if (
        context.profileId &&
        queryFeatures.includes(context.feature) &&
        totals.user_queries >= limits.userDailyQueries
      ) {
        return { kind: "blocked" as const, limit: "usuario" as const };
      }
      const [row] = await rows<{ id: string }>(
        transaction,
        sql`insert into public.ai_usage
              (namespace, feature, kind, space_id, profile_id, pricing_key,
               status, reserved_micro_usd, cost_micro_usd)
            values (${namespace}, ${context.feature}, ${input.kind},
              ${context.spaceId}, ${context.profileId}, ${input.pricingKey},
              'reservada', ${input.reserveMicroUsd}, ${input.reserveMicroUsd})
            returning id`,
      );
      return { kind: "reserved" as const, id: row.id };
    });
  }

  /** Only a pending reservation is settled, so nothing is charged twice. */
  async settle(
    id: string,
    outcome:
      | {
          status: "completada";
          costMicroUsd: number;
          inputTokens: number | null;
          outputTokens: number | null;
        }
      | { status: "liberada" }
      | { status: "incierta" },
  ): Promise<void> {
    const cost =
      outcome.status === "completada"
        ? sql`${outcome.costMicroUsd}`
        : outcome.status === "liberada"
          ? sql`0`
          : sql`reserved_micro_usd`;
    await this.database.execute(
      sql`update public.ai_usage
          set status = ${outcome.status}, cost_micro_usd = ${cost},
            input_tokens = ${outcome.status === "completada" ? outcome.inputTokens : null},
            output_tokens = ${outcome.status === "completada" ? outcome.outputTokens : null},
            settled_at = now()
          where id = ${id} and status = 'reservada'`,
    );
  }

  async summary(input: {
    namespace: string;
    spaceId: string;
    limits: UsageLimits;
  }): Promise<UsageSummary> {
    await ensureBudget(this.database, input.namespace);
    const [row] = await rows<{
      started_at: Date;
      space_today: string;
      global_used: string;
    }>(
      this.database,
      sql`select budget.started_at,
            coalesce((select sum(cost_micro_usd) from public.ai_usage
              where namespace = budget.namespace
                and space_id = ${input.spaceId}
                and created_at >= ${todayUtc}), 0) as space_today,
            coalesce((select sum(cost_micro_usd) from public.ai_usage
              where namespace = budget.namespace), 0) as global_used
          from public.ai_budgets budget
          where budget.namespace = ${input.namespace}`,
    );
    return {
      since: new Date(row.started_at),
      spaceTodayMicroUsd: Number(row.space_today),
      spaceDailyMicroUsd: input.limits.spaceDailyMicroUsd,
      // Other spaces' figures are not exposed, only whether it is exhausted.
      globalExhausted: Number(row.global_used) >= input.limits.globalMicroUsd,
    };
  }
}
