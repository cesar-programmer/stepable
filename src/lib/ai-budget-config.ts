import type { UsageLimits } from "../modules/usage/contract.ts";

/** Approved by the user on 2026-10-06; configurable by the operator. */
export const defaultUsageLimits = {
  globalUsd: 1,
  spaceDailyUsd: 0.2,
  userDailyQueries: 40,
} as const;

function positive(value: string | undefined, fallback: number, name: string) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} no es válido.`);
  }
  return parsed;
}

export function parseUsageLimits(
  values: Record<string, string | undefined>,
): UsageLimits {
  return {
    globalMicroUsd: Math.round(
      positive(
        values.STEPABLE_AI_BUDGET_GLOBAL_USD,
        defaultUsageLimits.globalUsd,
        "STEPABLE_AI_BUDGET_GLOBAL_USD",
      ) * 1_000_000,
    ),
    spaceDailyMicroUsd: Math.round(
      positive(
        values.STEPABLE_AI_BUDGET_SPACE_DAILY_USD,
        defaultUsageLimits.spaceDailyUsd,
        "STEPABLE_AI_BUDGET_SPACE_DAILY_USD",
      ) * 1_000_000,
    ),
    userDailyQueries: Math.floor(
      positive(
        values.STEPABLE_AI_USER_DAILY_QUERIES,
        defaultUsageLimits.userDailyQueries,
        "STEPABLE_AI_USER_DAILY_QUERIES",
      ),
    ),
  };
}
