import {
  modelRates,
  simulatedPricingKey,
  type ModelRate,
} from "../../lib/ai-pricing.ts";
import type {
  ChatCompletion,
  ChatModel,
  TextEmbedder,
} from "../knowledge/contract.ts";

import {
  AiBudgetExceededError,
  type AiCallKind,
  type UsageContext,
  type UsageLimits,
  type UsageRepository,
} from "./contract.ts";

const encoder = new TextEncoder();
const utf8Bytes = (text: string) => encoder.encode(text).length;

/**
 * Token bounds for a reservation. With byte-level BPE tokenizers (OpenAI's)
 * every token covers at least one UTF-8 byte, so the byte length bounds the
 * token count; it is an upper bound, not an average. A fixed allowance covers
 * per-message framing tokens.
 */
export const messageFramingTokens = 64;

export function chatTokenBound(input: {
  system: string;
  user: string;
  maxOutputTokens: number;
}) {
  return {
    inputTokens:
      utf8Bytes(input.system) + utf8Bytes(input.user) + messageFramingTokens,
    outputTokens: input.maxOutputTokens,
  };
}

export function embeddingTokenBound(texts: string[]): number {
  return texts.reduce(
    (total, text) => total + utf8Bytes(text) + messageFramingTokens,
    0,
  );
}

/** Tokens × USD per 1M tokens is exactly micro-dollars; rounded up. */
export function costMicroUsd(
  rate: ModelRate,
  inputTokens: number,
  outputTokens: number,
): number {
  return Math.ceil(
    inputTokens * rate.inputUsdPerMillion +
      outputTokens * rate.outputUsdPerMillion,
  );
}

/**
 * How a failed provider call is settled: "rechazada" when the provider
 * answered with a client error (the request was not processed, so nothing is
 * charged); anything else is uncertain and keeps the prudent reservation.
 */
export class ProviderCallError extends Error {
  readonly outcome: "rechazada" | "incierta";
  readonly usage?: { inputTokens: number; outputTokens: number };

  constructor(
    message: string,
    outcome: "rechazada" | "incierta",
    usage?: { inputTokens: number; outputTokens: number },
  ) {
    super(message);
    this.outcome = outcome;
    this.usage = usage;
  }
}

export type ChatLease = {
  complete(): Promise<ChatCompletion>;
  /** For a reservation whose call will not happen. */
  release(): Promise<void>;
};

/**
 * Wraps conversation and embedding calls with an atomic reservation against
 * the configured limits. Simulated models are not metered.
 */
export class AiMeter {
  private readonly repository: UsageRepository;
  private readonly namespace: string;
  private readonly limits: UsageLimits;
  private readonly rates: Record<string, ModelRate>;

  constructor(
    repository: UsageRepository,
    options: {
      namespace: string;
      limits: UsageLimits;
      rates?: Record<string, ModelRate>;
    },
  ) {
    this.repository = repository;
    this.namespace = options.namespace;
    this.limits = options.limits;
    this.rates = options.rates ?? modelRates;
  }

  /** null for simulated models; throws when a real model has no rate. */
  private rate(pricingKey: string | undefined): ModelRate | null {
    if (pricingKey?.startsWith(simulatedPricingKey)) return null;
    const rate = pricingKey ? this.rates[pricingKey] : undefined;
    if (!rate) throw new AiBudgetExceededError("sin_tarifa");
    return rate;
  }

  private async reserve(
    context: UsageContext,
    kind: AiCallKind,
    pricingKey: string,
    reserveMicroUsd: number,
  ): Promise<string> {
    const result = await this.repository.reserve({
      namespace: this.namespace,
      context,
      kind,
      pricingKey,
      reserveMicroUsd,
      limits: this.limits,
    });
    if (result.kind === "blocked") {
      throw new AiBudgetExceededError(result.limit);
    }
    return result.id;
  }

  private async settleFailure(id: string, error: unknown, rate: ModelRate) {
    if (error instanceof ProviderCallError && error.usage) {
      await this.repository.settle(id, {
        status: "completada",
        costMicroUsd: costMicroUsd(
          rate,
          error.usage.inputTokens,
          error.usage.outputTokens,
        ),
        inputTokens: error.usage.inputTokens,
        outputTokens: error.usage.outputTokens,
      });
    } else if (
      error instanceof ProviderCallError &&
      error.outcome === "rechazada"
    ) {
      await this.repository.settle(id, { status: "liberada" });
    } else {
      await this.repository.settle(id, { status: "incierta" });
    }
  }

  /** Reserves now; the call happens only through `complete()`. */
  async reserveChat(
    model: ChatModel,
    context: UsageContext,
    input: { system: string; user: string; maxOutputTokens: number },
  ): Promise<ChatLease> {
    const rate = this.rate(model.pricingKey);
    if (!rate) {
      return { complete: () => model.complete(input), release: async () => {} };
    }
    const bound = chatTokenBound(input);
    const id = await this.reserve(
      context,
      "conversacion",
      model.pricingKey as string,
      costMicroUsd(rate, bound.inputTokens, bound.outputTokens),
    );
    let settled = false;
    return {
      complete: async () => {
        settled = true;
        let completion: ChatCompletion;
        try {
          completion = await model.complete(input);
        } catch (error) {
          await this.settleFailure(id, error, rate);
          throw error;
        }
        await this.repository.settle(
          id,
          completion.usage
            ? {
                status: "completada",
                costMicroUsd: costMicroUsd(
                  rate,
                  completion.usage.inputTokens,
                  completion.usage.outputTokens,
                ),
                inputTokens: completion.usage.inputTokens,
                outputTokens: completion.usage.outputTokens,
              }
            : // Without reported usage the prudent reservation stays.
              { status: "incierta" },
        );
        return completion;
      },
      release: async () => {
        if (settled) return;
        settled = true;
        await this.repository.settle(id, { status: "liberada" });
      },
    };
  }

  /** A ChatModel that reserves and settles around every call. */
  chat(model: ChatModel, context: UsageContext): ChatModel {
    return {
      label: model.label,
      pricingKey: model.pricingKey,
      complete: async (input) =>
        (await this.reserveChat(model, context, input)).complete(),
    };
  }

  /** A TextEmbedder that reserves and settles around every request. */
  embedder(embedder: TextEmbedder, context: UsageContext): TextEmbedder {
    return {
      model: embedder.model,
      embed: async (texts) => {
        const rate = this.rate(embedder.model);
        if (!rate) return embedder.embed(texts);
        const id = await this.reserve(
          context,
          "embeddings",
          embedder.model,
          costMicroUsd(rate, embeddingTokenBound(texts), 0),
        );
        try {
          if (embedder.embedWithUsage) {
            const result = await embedder.embedWithUsage(texts);
            await this.repository.settle(
              id,
              result.inputTokens === null
                ? { status: "incierta" }
                : {
                    status: "completada",
                    costMicroUsd: costMicroUsd(rate, result.inputTokens, 0),
                    inputTokens: result.inputTokens,
                    outputTokens: 0,
                  },
            );
            return result.vectors;
          }
          const vectors = await embedder.embed(texts);
          await this.repository.settle(id, { status: "incierta" });
          return vectors;
        } catch (error) {
          await this.settleFailure(id, error, rate);
          throw error;
        }
      },
    };
  }
}
