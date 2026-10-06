import type { RealModelConfig } from "../../lib/ai-config.ts";
import { ProviderCallError } from "../../modules/usage/meter.ts";
import type {
  ChatCompletion,
  ChatModel,
  TextEmbedder,
} from "../../modules/knowledge/contract.ts";

/**
 * Minimal client for OpenAI-compatible HTTP APIs (chat completions and
 * embeddings). One request per call, a fixed timeout and no retries; error
 * messages carry the HTTP status only, never keys or request bodies. A client
 * error (4xx except 408) means the request was not processed; other failures
 * are uncertain for consumption purposes.
 */
async function postJson(
  config: RealModelConfig,
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ProviderCallError(
      "No se obtuvo respuesta del proveedor.",
      "incierta",
    );
  }
  if (!response.ok) {
    throw new ProviderCallError(
      `El proveedor respondió ${response.status}.`,
      response.status >= 400 && response.status < 500 && response.status !== 408
        ? "rechazada"
        : "incierta",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ProviderCallError(
      "Respuesta del proveedor no válida.",
      "incierta",
    );
  }
}

type ChatResponse = {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class OpenAiCompatibleChatModel implements ChatModel {
  readonly label: string;
  readonly pricingKey: string;
  private readonly config: RealModelConfig;
  private readonly timeoutMs: number;

  constructor(config: RealModelConfig, options: { timeoutMs?: number } = {}) {
    this.config = config;
    this.label = `${config.provider} · ${config.model}`;
    this.pricingKey = `${config.provider}:${config.model}`;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async complete(input: {
    system: string;
    user: string;
    maxOutputTokens: number;
  }): Promise<ChatCompletion> {
    // OpenAI's newer models only accept max_completion_tokens.
    const outputLimit =
      this.config.provider === "openai"
        ? { max_completion_tokens: input.maxOutputTokens }
        : { max_tokens: input.maxOutputTokens };
    const payload = (await postJson(
      this.config,
      "/chat/completions",
      {
        model: this.config.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        response_format: { type: "json_object" },
        stream: false,
        ...outputLimit,
      },
      this.timeoutMs,
    )) as ChatResponse;
    const usage = payload.usage && {
      inputTokens: payload.usage.prompt_tokens ?? 0,
      outputTokens: payload.usage.completion_tokens ?? 0,
    };
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      // Processed (and billed) even without usable content.
      throw new ProviderCallError(
        "El proveedor no devolvió contenido.",
        "incierta",
        usage,
      );
    }
    return { text, usage };
  }
}

type EmbeddingsResponse = {
  data?: { index: number; embedding: number[] }[];
  usage?: { prompt_tokens?: number };
};

export class OpenAiCompatibleEmbedder implements TextEmbedder {
  readonly model: string;
  private readonly config: RealModelConfig;
  private readonly timeoutMs: number;

  constructor(config: RealModelConfig, options: { timeoutMs?: number } = {}) {
    this.config = config;
    this.model = `${config.provider}:${config.model}`;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return (await this.embedWithUsage(texts)).vectors;
  }

  async embedWithUsage(
    texts: string[],
  ): Promise<{ vectors: number[][]; inputTokens: number | null }> {
    const payload = (await postJson(
      this.config,
      "/embeddings",
      { model: this.config.model, input: texts },
      this.timeoutMs,
    )) as EmbeddingsResponse;
    const vectors = [...(payload.data ?? [])]
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding);
    const inputTokens = payload.usage?.prompt_tokens ?? null;
    if (vectors.length !== texts.length) {
      throw new ProviderCallError(
        "El proveedor devolvió un número distinto de vectores.",
        "incierta",
        inputTokens === null ? undefined : { inputTokens, outputTokens: 0 },
      );
    }
    return { vectors, inputTokens };
  }
}
