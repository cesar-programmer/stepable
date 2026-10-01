import type { SpaceRole } from "../access/contract.ts";

export const routeLimits = {
  objectiveMinChars: 10,
  objectiveMaxChars: 500,
  maxSources: 5,
  minGeneratedSteps: 3,
  maxSteps: 7,
  minOptions: 3,
  maxOptions: 4,
  titleMaxChars: 120,
  lessonMaxChars: 2000,
  questionMaxChars: 400,
  optionMaxChars: 200,
  explanationMaxChars: 800,
  candidates: 12,
  fragments: 12,
  fragmentMaxChars: 1500,
  contextMaxChars: 16000,
  maxOutputTokens: 3000,
  dailyGenerationAttempts: 5,
} as const;

export const routeStatuses = ["borrador", "publicada"] as const;
export const routeGenerationStatuses = [
  "en_cola",
  "generando",
  "lista",
  "insuficiente",
  "fallida",
] as const;

export type RouteStatus = (typeof routeStatuses)[number];
export type RouteGenerationStatus = (typeof routeGenerationStatuses)[number];

/** Computed when reading: the cited version compared with the current one. */
export type CitationState = "vigente" | "version_anterior" | "fuente_eliminada";

export type RouteCitation = {
  ref: number;
  sourceId: string;
  versionId: string;
  versionNumber: number;
  sourceTitle: string;
  location: string;
  state: CitationState;
  currentVersionNumber: number | null;
};

export type RouteStep = {
  id: string;
  position: number;
  title: string;
  lesson: string;
  question: string;
  options: string[];
  /** Null for members: the answer key is not delivered before E5. */
  correctOption: number | null;
  explanation: string | null;
  citations: RouteCitation[];
};

export type RouteSummary = {
  id: string;
  title: string | null;
  objective: string;
  status: RouteStatus;
  generationStatus: RouteGenerationStatus;
  generationError: string | null;
  needsReview: boolean;
  updatedAt: Date;
};

export type RouteDetail = RouteSummary & {
  editVersion: number;
  publishedAt: Date | null;
  sources: { id: string; title: string | null; active: boolean }[];
  steps: RouteStep[];
};

/** A step as generated, with citations already resolved from fragments. */
export type DraftStep = Omit<
  RouteStep,
  "id" | "citations" | "correctOption" | "explanation"
> & {
  correctOption: number;
  explanation: string;
  citations: Omit<RouteCitation, "state" | "currentVersionNumber">[];
};

export type StepEdit = {
  title: string;
  lesson: string;
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
};

export type RouteMutationResult =
  | { kind: "ok" }
  | {
      kind:
        | "unauthorized"
        | "not_found"
        | "not_editable"
        | "conflict"
        | "invalid"
        | "citas_no_vigentes"
        | "sin_pasos";
    };

export type RequestGenerationResult =
  | { kind: "queued"; routeId: string }
  | {
      kind:
        | "unauthorized"
        | "not_found"
        | "invalid"
        | "fuentes_no_disponibles"
        | "generacion_en_curso"
        | "limite_diario"
        | "not_editable";
    };

export type GenerationClaim = {
  routeId: string;
  spaceId: string;
  objective: string;
  sourceIds: string[];
};

export interface RouteRepository {
  createRoute(input: {
    routeId: string;
    actorIdentityId: string;
    spaceId: string;
    objective: string;
    sourceIds: string[];
    token: string;
  }): Promise<RequestGenerationResult>;
  requestRegeneration(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    token: string;
  }): Promise<RequestGenerationResult>;
  claimGeneration(
    routeId: string,
    token: string,
  ): Promise<GenerationClaim | null>;
  /** Records an attempt right before calling the provider, within the limit. */
  reserveGenerationAttempt(spaceId: string, routeId: string): Promise<boolean>;
  finishGeneration(input: {
    routeId: string;
    token: string;
    status: "lista" | "insuficiente" | "fallida";
    errorCode?: string;
    title?: string;
    steps?: DraftStep[];
  }): Promise<boolean>;
  failStaleGenerations(startedBefore: Date): Promise<number>;
  listRoutes(spaceId: string, onlyPublished: boolean): Promise<RouteSummary[]>;
  findRoute(
    spaceId: string,
    routeId: string,
    onlyPublished: boolean,
  ): Promise<RouteDetail | null>;
  updateStep(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    editVersion: number;
    edit: StepEdit;
  }): Promise<RouteMutationResult>;
  moveStep(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    editVersion: number;
    direction: "up" | "down";
  }): Promise<RouteMutationResult>;
  deleteStep(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    editVersion: number;
  }): Promise<RouteMutationResult>;
  publishRoute(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    editVersion: number;
  }): Promise<RouteMutationResult>;
}

export type RouteListing = {
  role: SpaceRole;
  canManage: boolean;
  routes: RouteSummary[];
};
