import type { SourceFormat } from "../sources/contract.ts";
import type { BudgetLimit } from "../usage/contract.ts";

/** Per-query bounds: one model call, bounded context and output. */
export const assistantLimits = {
  questionMinChars: 3,
  questionMaxChars: 500,
  lexicalCandidates: 12,
  semanticCandidates: 12,
  fragments: 6,
  fragmentMaxChars: 1500,
  contextMaxChars: 9000,
  maxOutputTokens: 700,
  answerMaxChars: 4000,
  embeddingInputMaxChars: 6000,
  embeddingBatchSize: 32,
} as const;

/** A segment of a current, ready version of an active source in the space. */
export type FragmentCandidate = {
  versionId: string;
  ordinal: number;
  sourceId: string;
  sourceTitle: string;
  versionNumber: number;
  format: SourceFormat;
  pageNumber: number | null;
  headingPath: string[];
  startLine: number | null;
  endLine: number | null;
  content: string;
};

/** A candidate sent to the model, numbered from 1 for citations. */
export type RetrievedFragment = FragmentCandidate & { ref: number };

export type Citation = {
  ref: number;
  sourceId: string;
  sourceTitle: string;
  versionNumber: number;
  location: string;
};

export type RetrievalDiagnostics = {
  lexical: number;
  semantic: number | null;
};

export type AssistantResult =
  | {
      kind: "answered";
      answer: string;
      citations: Citation[];
      fragments: RetrievedFragment[];
      retrieval: RetrievalDiagnostics;
    }
  | {
      kind: "insufficient" | "retrieval_only" | "unverifiable" | "model_error";
      fragments: RetrievedFragment[];
      retrieval: RetrievalDiagnostics;
    }
  | {
      /** The model was not called: a consumption limit applies (RF-10). */
      kind: "budget_exceeded";
      limit: BudgetLimit;
      fragments: RetrievedFragment[];
      retrieval: RetrievalDiagnostics;
    }
  | { kind: "unauthorized" | "invalid_question" };

export type EmbeddingVector = { model: string; values: number[] };

export interface KnowledgeRepository {
  /** `sourceIds` restricts the search to those sources of the space. */
  searchLexical(
    spaceId: string,
    question: string,
    limit: number,
    sourceIds?: string[],
  ): Promise<FragmentCandidate[]>;
  searchSemantic(
    spaceId: string,
    embedding: EmbeddingVector,
    limit: number,
    sourceIds?: string[],
  ): Promise<FragmentCandidate[]>;
  listSegmentsMissingEmbeddings(
    model: string,
    limit: number,
    versionIds?: string[],
  ): Promise<
    { versionId: string; ordinal: number; content: string; spaceId: string }[]
  >;
  saveEmbeddings(
    model: string,
    rows: { versionId: string; ordinal: number; values: number[] }[],
  ): Promise<number>;
}

export type ChatCompletion = {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
};

/** One request to a conversation model; no retries inside. */
export interface ChatModel {
  readonly label: string;
  /** "provider:model" used to look up the estimated rate (RF-10). */
  readonly pricingKey?: string;
  complete(input: {
    system: string;
    user: string;
    maxOutputTokens: number;
  }): Promise<ChatCompletion>;
}

/** Embeddings are configured separately from the conversation model. */
export interface TextEmbedder {
  /** Also the pricing key ("provider:model") for real embedders. */
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
  /** Same request, also returning the input tokens the provider reported. */
  embedWithUsage?(
    texts: string[],
  ): Promise<{ vectors: number[][]; inputTokens: number | null }>;
}
