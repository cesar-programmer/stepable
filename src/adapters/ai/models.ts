import {
  parseChatModelConfig,
  parseEmbeddingModelConfig,
} from "../../lib/ai-config.ts";
import type {
  ChatModel,
  TextEmbedder,
} from "../../modules/knowledge/contract.ts";

import {
  OpenAiCompatibleChatModel,
  OpenAiCompatibleEmbedder,
} from "./openai-compatible.ts";
import { SimulatedChatModel, SimulatedEmbedder } from "./simulated.ts";

export type ConfiguredModels = {
  chatModel: ChatModel | null;
  embedder: TextEmbedder | null;
  chatMode: string;
  embeddingsMode: string;
  configurationError: string | null;
};

/** Builds both adapters from the server environment; nothing is shared. */
export function configuredModels(
  values: Record<string, string | undefined>,
): ConfiguredModels {
  try {
    const chat = parseChatModelConfig(values);
    const embeddings = parseEmbeddingModelConfig(values);
    return {
      chatModel:
        chat.mode === "real"
          ? new OpenAiCompatibleChatModel(chat)
          : chat.mode === "simulado"
            ? new SimulatedChatModel()
            : null,
      embedder:
        embeddings.mode === "real"
          ? new OpenAiCompatibleEmbedder(embeddings)
          : embeddings.mode === "simulado"
            ? new SimulatedEmbedder()
            : null,
      chatMode:
        chat.mode === "real"
          ? `real · ${chat.provider} · ${chat.model}`
          : chat.mode,
      embeddingsMode:
        embeddings.mode === "real"
          ? `real · ${embeddings.provider} · ${embeddings.model}`
          : embeddings.mode,
      configurationError: null,
    };
  } catch (error) {
    return {
      chatModel: null,
      embedder: null,
      chatMode: "desactivado",
      embeddingsMode: "desactivado",
      configurationError:
        error instanceof Error
          ? error.message
          : "Configuración de IA no válida.",
    };
  }
}
