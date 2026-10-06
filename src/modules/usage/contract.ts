export const aiFeatures = [
  "asistente",
  "ayuda",
  "generacion",
  "indexacion",
] as const;
export type AiFeature = (typeof aiFeatures)[number];
export type AiCallKind = "conversacion" | "embeddings";

/** Which limit stopped a call; "sin_tarifa" means no configured rate. */
export type BudgetLimit = "global" | "espacio" | "usuario" | "sin_tarifa";

/** Configurable limits, in micro-dollars (1e-6 USD) and queries. */
export type UsageLimits = {
  globalMicroUsd: number;
  spaceDailyMicroUsd: number;
  /** Assistant and contextual help, all spaces of the user together. */
  userDailyQueries: number;
};

export type UsageContext = {
  feature: AiFeature;
  spaceId: string | null;
  profileId: string | null;
};

export type ReserveResult =
  | { kind: "reserved"; id: string }
  | { kind: "blocked"; limit: Exclude<BudgetLimit, "sin_tarifa"> };

export type UsageSummary = {
  since: Date;
  spaceTodayMicroUsd: number;
  spaceDailyMicroUsd: number;
  globalExhausted: boolean;
};

export interface UsageRepository {
  /**
   * Atomically checks the global, space-daily and (for queries) user-daily
   * limits of the namespace and records a reservation if all allow it.
   */
  reserve(input: {
    namespace: string;
    context: UsageContext;
    kind: AiCallKind;
    pricingKey: string;
    reserveMicroUsd: number;
    limits: UsageLimits;
  }): Promise<ReserveResult>;
  settle(
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
  ): Promise<void>;
  summary(input: {
    namespace: string;
    spaceId: string;
    limits: UsageLimits;
  }): Promise<UsageSummary>;
}

/** Thrown by metered models instead of calling the provider. */
export class AiBudgetExceededError extends Error {
  readonly limit: BudgetLimit;

  constructor(limit: BudgetLimit) {
    super(`Límite de consumo de IA: ${limit}`);
    this.limit = limit;
  }
}
