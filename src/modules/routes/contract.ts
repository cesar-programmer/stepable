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
  codeMaxChars: 3000,
  codeLanguageMaxChars: 30,
  maxAcceptedAnswers: 5,
  answerMaxChars: 200,
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

/**
 * "fuente": copied from a cited fragment; "ilustrativo": an example built
 * from the sources, never presented as the company's real code.
 */
export const codeOrigins = ["fuente", "ilustrativo"] as const;
export type CodeOrigin = (typeof codeOrigins)[number];

/** Optional read-only snippet; plain text, never executed or parsed. */
export type StepCode = {
  content: string;
  language: string | null;
  origin: CodeOrigin;
};

/**
 * "opcion_multiple": choose one option. "completar": write the text for the
 * single `codeHoleMarker` in the step's code; graded by exact comparison
 * with the accepted answers, ignoring only leading and trailing spaces.
 */
export const activityTypes = ["opcion_multiple", "completar"] as const;
export type ActivityType = (typeof activityTypes)[number];
export const codeHoleMarker = "[[hueco]]";

/**
 * Kinds a responsible can request for a generated draft; each one must
 * appear in at least one step. "lectura_codigo" is a multiple-choice step
 * with code; "opcion_multiple" is one without code.
 */
export const requestedActivityTypes = [
  "opcion_multiple",
  "lectura_codigo",
  "completar",
] as const;
export type RequestedActivity = (typeof requestedActivityTypes)[number];

export type RouteStep = {
  id: string;
  position: number;
  title: string;
  lesson: string;
  question: string;
  activityType: ActivityType;
  code: StepCode | null;
  /** Empty for "completar". */
  options: string[];
  /** Null for members and for "completar". */
  correctOption: number | null;
  /** "completar" only; the first is the main answer. Null for members. */
  acceptedAnswers: string[] | null;
  explanation: string | null;
  citations: RouteCitation[];
};

export type RouteSummary = {
  id: string;
  title: string | null;
  objective: string;
  requestedActivities: RequestedActivity[];
  status: RouteStatus;
  generationStatus: RouteGenerationStatus;
  generationError: string | null;
  /** Requested types the draft lacked ("tipos_no_cubiertos"); null if unknown. */
  missingActivities: RequestedActivity[] | null;
  needsReview: boolean;
  updatedAt: Date;
};

export type RouteDetail = RouteSummary & {
  editVersion: number;
  publishedAt: Date | null;
  /**
   * `hasCodeBlock`: the current version has a fenced code block (```), the
   * only code signal detected; code in PDFs or plain text is not detected.
   */
  sources: {
    id: string;
    title: string | null;
    active: boolean;
    hasCodeBlock: boolean;
  }[];
  steps: RouteStep[];
};

/** A step as generated, with citations already resolved from fragments. */
export type DraftStep = Omit<RouteStep, "id" | "citations" | "explanation"> & {
  explanation: string;
  citations: Omit<RouteCitation, "state" | "currentVersionNumber">[];
};

export type StepEdit = {
  title: string;
  lesson: string;
  question: string;
  activityType: ActivityType;
  code: StepCode | null;
  options: string[];
  correctOption: number | null;
  acceptedAnswers: string[] | null;
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
        | "sin_pasos"
        | "fuentes_no_disponibles";
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
  requestedActivities: RequestedActivity[];
  sourceIds: string[];
};

export interface RouteRepository {
  createRoute(input: {
    routeId: string;
    actorIdentityId: string;
    spaceId: string;
    objective: string;
    requestedActivities: RequestedActivity[];
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
    missingActivities?: RequestedActivity[];
    title?: string;
    steps?: DraftStep[];
  }): Promise<boolean>;
  failStaleGenerations(startedBefore: Date): Promise<number>;
  /**
   * Changes what the next generation will use (objective, sources, types) of
   * a draft whose generation failed or lacked evidence. No provider call and
   * no generation attempt.
   */
  updateGenerationRequest(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    editVersion: number;
    objective: string;
    requestedActivities: RequestedActivity[];
    sourceIds: string[];
  }): Promise<RouteMutationResult>;
  /** Generation attempts used today (UTC) in the space, queued ones included. */
  countGenerationsToday(spaceId: string): Promise<number>;
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
