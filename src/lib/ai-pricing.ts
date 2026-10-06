/**
 * Estimated rates, in USD per 1M tokens, for the models the prototype may
 * call. Verified on the official OpenAI pricing page (Standard tier). They
 * are used to estimate and limit consumption; they are not the provider's
 * invoice. A model missing here cannot be used with real calls.
 */
export const pricingVerifiedAt = "2026-10-06";
export const pricingSource = "https://developers.openai.com/api/docs/pricing";

export type ModelRate = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

export const modelRates: Record<string, ModelRate> = {
  "openai:gpt-4.1-mini": { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
  "openai:text-embedding-3-small": {
    inputUsdPerMillion: 0.02,
    outputUsdPerMillion: 0,
  },
};

/** Simulated models (keys starting with it) cost nothing; not metered. */
export const simulatedPricingKey = "simulado";
