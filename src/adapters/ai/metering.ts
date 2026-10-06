import { parseUsageLimits } from "../../lib/ai-budget-config.ts";
import { modelRates, simulatedPricingKey } from "../../lib/ai-pricing.ts";
import { parseJobNamespace } from "../../lib/job-namespace.ts";
import type {
  ChatModel,
  TextEmbedder,
} from "../../modules/knowledge/contract.ts";
import { AiMeter } from "../../modules/usage/meter.ts";
import type { StepableDatabase } from "../postgres/database.ts";
import { PostgresUsageRepository } from "../postgres/usage-repository.ts";

/** Meter for the current namespace ("local", or "pruebas" in tests). */
export function configuredMeter(
  database: StepableDatabase,
  values: Record<string, string | undefined>,
): AiMeter {
  return new AiMeter(new PostgresUsageRepository(database), {
    namespace: parseJobNamespace(values),
    limits: parseUsageLimits(values),
  });
}

/**
 * Real models without a configured rate. Calls to them are refused, so this
 * is reported up front (worker start, evaluation scripts).
 */
export function unpricedModels(
  chatModel: ChatModel | null,
  embedder: TextEmbedder | null,
): string[] {
  const keys = [
    ...(chatModel ? [chatModel.pricingKey ?? chatModel.label] : []),
    ...(embedder ? [embedder.model] : []),
  ];
  return keys.filter(
    (key) => !key.startsWith(simulatedPricingKey) && !modelRates[key],
  );
}
