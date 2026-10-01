import { describe, expect, it } from "vitest";

import { parseChatModelConfig, parseEmbeddingModelConfig } from "./ai-config";

describe("AI configuration", () => {
  it("is disabled unless a mode is chosen explicitly", () => {
    expect(parseChatModelConfig({ DEEPSEEK_API_KEY: "local" })).toEqual({
      mode: "desactivado",
    });
  });

  it("configures chat and embeddings independently", () => {
    const values = {
      STEPABLE_AI_CHAT_MODE: "real",
      STEPABLE_AI_CHAT_PROVIDER: "deepseek",
      STEPABLE_AI_CHAT_MODEL: "modelo-chat",
      DEEPSEEK_API_KEY: "local-key",
      STEPABLE_AI_EMBEDDINGS_MODE: "simulado",
    };
    expect(parseChatModelConfig(values)).toMatchObject({
      mode: "real",
      provider: "deepseek",
      model: "modelo-chat",
      baseUrl: "https://api.deepseek.com",
    });
    expect(parseEmbeddingModelConfig(values)).toEqual({ mode: "simulado" });
  });

  it("requires the provider key for real mode", () => {
    expect(() =>
      parseEmbeddingModelConfig({
        STEPABLE_AI_EMBEDDINGS_MODE: "real",
        STEPABLE_AI_EMBEDDINGS_PROVIDER: "openai",
        STEPABLE_AI_EMBEDDINGS_MODEL: "modelo-embeddings",
      }),
    ).toThrow("OPENAI_API_KEY");
  });
});
