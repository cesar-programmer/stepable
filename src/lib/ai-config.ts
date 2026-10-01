import { z } from "zod";

/**
 * AI settings are read from server-only environment variables. Nothing is
 * enabled by default: "real" must be chosen explicitly, and test commands
 * force "simulado" so they never reach a paid provider.
 */
export const aiProviders = ["deepseek", "openai"] as const;
export type AiProvider = (typeof aiProviders)[number];

// Both providers expose an OpenAI-compatible HTTP API; the base URL can be
// overridden if the provider documents a different one.
const defaultBaseUrls: Record<AiProvider, string> = {
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
};

const apiKeyVariables: Record<AiProvider, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
};

const modeSchema = z
  .enum(["desactivado", "simulado", "real"])
  .default("desactivado");

export type RealModelConfig = {
  mode: "real";
  provider: AiProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
};

export type ModelConfig =
  { mode: "desactivado" } | { mode: "simulado" } | RealModelConfig;

function parseModelConfig(
  values: Record<string, string | undefined>,
  prefix: "CHAT" | "EMBEDDINGS",
): ModelConfig {
  const mode = modeSchema.parse(
    values[`STEPABLE_AI_${prefix}_MODE`] || undefined,
  );
  if (mode !== "real") return { mode };

  const provider = z
    .enum(aiProviders)
    .parse(values[`STEPABLE_AI_${prefix}_PROVIDER`]);
  const model = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .parse(values[`STEPABLE_AI_${prefix}_MODEL`]);
  const baseUrl = z
    .url()
    .parse(
      values[`STEPABLE_AI_${prefix}_BASE_URL`] || defaultBaseUrls[provider],
    );
  const apiKey = values[apiKeyVariables[provider]];
  if (!apiKey) {
    throw new Error(
      `Falta ${apiKeyVariables[provider]} en el entorno local del servidor.`,
    );
  }
  return {
    mode,
    provider,
    model,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
  };
}

export function parseChatModelConfig(
  values: Record<string, string | undefined>,
): ModelConfig {
  return parseModelConfig(values, "CHAT");
}

export function parseEmbeddingModelConfig(
  values: Record<string, string | undefined>,
): ModelConfig {
  return parseModelConfig(values, "EMBEDDINGS");
}
