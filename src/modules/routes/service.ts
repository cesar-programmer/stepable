import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  allowsSpaceAction,
  authorizeSpaceAction,
} from "../access/authorization.ts";
import type { AccessRepository } from "../access/contract.ts";
import type {
  ChatModel,
  KnowledgeRepository,
  TextEmbedder,
} from "../knowledge/contract.ts";
import { mergeCandidates, prepareFragments } from "../knowledge/retrieval.ts";
import { AiBudgetExceededError, type BudgetLimit } from "../usage/contract.ts";
import type { AiMeter } from "../usage/meter.ts";

import {
  requestedActivityTypes,
  routeLimits,
  type RequestedActivity,
  type DraftStep,
  type RequestGenerationResult,
  type RouteDetail,
  type RouteListing,
  type RouteMutationResult,
  type RouteRepository,
} from "./contract.ts";
import {
  buildRoutePrompt,
  parseGeneratedRoute,
  missingRequestedActivities,
  stepEditSchema,
} from "./generation.ts";

type Dependencies = {
  accessRepository: AccessRepository;
  routeRepository: RouteRepository;
};

const requestSchema = z.object({
  objective: z
    .string()
    .trim()
    .min(routeLimits.objectiveMinChars)
    .max(routeLimits.objectiveMaxChars),
  sourceIds: z
    .array(z.uuid())
    .min(1)
    .max(routeLimits.maxSources)
    .refine((ids) => new Set(ids).size === ids.length),
  // Multiple choice alone keeps the previous behavior.
  activityTypes: z
    .array(z.enum(requestedActivityTypes))
    .min(1)
    .refine((types) => new Set(types).size === types.length)
    .default(["opcion_multiple"]),
});

async function canManage(
  dependencies: Dependencies,
  identityId: string,
  spaceId: string,
) {
  return Boolean(
    await authorizeSpaceAction(
      dependencies.accessRepository,
      identityId,
      spaceId,
      "gestionar_rutas",
    ),
  );
}

/** Creates a draft and queues its generation (no provider call here). */
export async function requestRouteDraft(
  dependencies: Dependencies,
  input: {
    identityId: string;
    spaceId: string;
    objective: string;
    sourceIds: string[];
    activityTypes?: RequestedActivity[];
  },
): Promise<RequestGenerationResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid" };
  if (!(await canManage(dependencies, input.identityId, input.spaceId))) {
    return { kind: "unauthorized" };
  }
  return dependencies.routeRepository.createRoute({
    routeId: randomUUID(),
    actorIdentityId: input.identityId,
    spaceId: input.spaceId,
    objective: parsed.data.objective,
    // Stored in a fixed order so the prompt does not depend on the form.
    requestedActivities: requestedActivityTypes.filter((type) =>
      parsed.data.activityTypes.includes(type),
    ),
    sourceIds: parsed.data.sourceIds,
    token: randomUUID(),
  });
}

/**
 * Saves a new objective, sources and activity types for a draft whose
 * generation failed or lacked evidence. It never calls the model nor uses a
 * generation attempt; generating again is a separate, explicit request.
 */
export async function updateRouteRequest(
  dependencies: Dependencies,
  input: {
    identityId: string;
    spaceId: string;
    routeId: string;
    editVersion: number;
    objective: string;
    sourceIds: string[];
    activityTypes: RequestedActivity[];
  },
): Promise<RouteMutationResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid" };
  if (!(await canManage(dependencies, input.identityId, input.spaceId))) {
    return { kind: "unauthorized" };
  }
  return dependencies.routeRepository.updateGenerationRequest({
    actorIdentityId: input.identityId,
    spaceId: input.spaceId,
    routeId: input.routeId,
    editVersion: input.editVersion,
    objective: parsed.data.objective,
    requestedActivities: requestedActivityTypes.filter((type) =>
      parsed.data.activityTypes.includes(type),
    ),
    sourceIds: parsed.data.sourceIds,
  });
}

export async function requestRouteRegeneration(
  dependencies: Dependencies,
  input: { identityId: string; spaceId: string; routeId: string },
): Promise<RequestGenerationResult> {
  if (!(await canManage(dependencies, input.identityId, input.spaceId))) {
    return { kind: "unauthorized" };
  }
  return dependencies.routeRepository.requestRegeneration({
    actorIdentityId: input.identityId,
    spaceId: input.spaceId,
    routeId: input.routeId,
    token: randomUUID(),
  });
}

const budgetErrorCodes: Record<BudgetLimit, string> = {
  global: "limite_consumo_global",
  espacio: "limite_consumo_espacio",
  // Generation has no user limit; kept for completeness.
  usuario: "limite_consumo_usuario",
  sin_tarifa: "tarifa_no_configurada",
};

export type GenerationOutcome =
  "omitida" | "lista" | "insuficiente" | "fallida";

/**
 * Worker step for one queued generation. The token claim makes a re-delivered
 * job a no-op, so a paid call is never repeated; there are no automatic
 * retries. Only fragments of the selected sources reach the model.
 */
export async function generateRouteDraft(
  dependencies: {
    routeRepository: RouteRepository;
    knowledgeRepository: KnowledgeRepository;
    chatModel: ChatModel | null;
    embedder: TextEmbedder | null;
    /** RF-10: reserves estimated consumption before each real call. */
    meter?: AiMeter;
    log?: (entry: Record<string, unknown>) => void;
  },
  input: { routeId: string; token: string },
): Promise<GenerationOutcome> {
  const repository = dependencies.routeRepository;
  const claim = await repository.claimGeneration(input.routeId, input.token);
  if (!claim) return "omitida";
  const finish = async (
    status: "lista" | "insuficiente" | "fallida",
    extra: {
      errorCode?: string;
      errorDetail?: string;
      missingActivities?: RequestedActivity[];
      title?: string;
      steps?: DraftStep[];
    } = {},
  ): Promise<GenerationOutcome> =>
    (await repository.finishGeneration({
      routeId: input.routeId,
      token: input.token,
      status,
      ...extra,
    }))
      ? status
      : "omitida";

  const lexical = await dependencies.knowledgeRepository.searchLexical(
    claim.spaceId,
    claim.objective,
    routeLimits.candidates,
    claim.sourceIds,
  );
  const usage = {
    feature: "generacion" as const,
    spaceId: claim.spaceId,
    profileId: null,
  };
  const embedder =
    dependencies.embedder && dependencies.meter
      ? dependencies.meter.embedder(dependencies.embedder, usage)
      : dependencies.embedder;
  let semantic: typeof lexical = [];
  if (embedder) {
    try {
      const [values] = await embedder.embed([claim.objective]);
      semantic = await dependencies.knowledgeRepository.searchSemantic(
        claim.spaceId,
        { model: embedder.model, values },
        routeLimits.candidates,
        claim.sourceIds,
      );
    } catch {
      semantic = [];
    }
  }
  const fragments = prepareFragments(
    mergeCandidates([lexical, semantic], routeLimits.fragments),
    routeLimits,
  );
  if (fragments.length === 0) return finish("insuficiente");
  if (!dependencies.chatModel) {
    return finish("fallida", { errorCode: "modelo_no_configurado" });
  }
  const prompt = {
    ...buildRoutePrompt(claim.objective, fragments, claim.requestedActivities),
    maxOutputTokens: routeLimits.maxOutputTokens,
  };
  // The consumption reservation comes first, so a reached budget never uses
  // one of the daily generation attempts.
  let lease;
  try {
    lease = dependencies.meter
      ? await dependencies.meter.reserveChat(
          dependencies.chatModel,
          usage,
          prompt,
        )
      : {
          complete: () => dependencies.chatModel!.complete(prompt),
          release: async () => {},
        };
  } catch (error) {
    if (error instanceof AiBudgetExceededError) {
      return finish("fallida", { errorCode: budgetErrorCodes[error.limit] });
    }
    throw error;
  }
  if (
    !(await repository.reserveGenerationAttempt(claim.spaceId, claim.routeId))
  ) {
    await lease.release();
    return finish("fallida", { errorCode: "limite_diario" });
  }

  let completion;
  const startedAt = Date.now();
  try {
    completion = await lease.complete();
  } catch {
    return finish("fallida", { errorCode: "modelo_no_disponible" });
  }
  const parsed = parseGeneratedRoute(completion.text, fragments);
  // The prompt asks for every requested type; the server checks it and
  // never retries on its own.
  const missing =
    parsed.kind === "generated"
      ? missingRequestedActivities(parsed.steps, claim.requestedActivities)
      : [];
  dependencies.log?.({
    event: "route_generation",
    routeId: claim.routeId,
    spaceId: claim.spaceId,
    outcome: parsed.kind,
    invalidDetail: parsed.kind === "invalid" ? parsed.detail : undefined,
    requested: claim.requestedActivities,
    missing,
    fragments: fragments.length,
    usage: completion.usage,
    durationMs: Date.now() - startedAt,
  });
  if (parsed.kind === "insufficient") return finish("insuficiente");
  if (parsed.kind === "invalid") {
    return finish("fallida", {
      errorCode: parsed.reason ?? "borrador_no_valido",
      errorDetail: parsed.detail?.slice(0, 120),
    });
  }
  if (missing.length > 0) {
    return finish("fallida", {
      errorCode: "tipos_no_cubiertos",
      missingActivities: missing,
    });
  }
  return finish("lista", { title: parsed.title, steps: parsed.steps });
}

export async function listSpaceRoutes(
  dependencies: Dependencies,
  input: { identityId: string; spaceId: string },
): Promise<RouteListing | null> {
  const space = await authorizeSpaceAction(
    dependencies.accessRepository,
    input.identityId,
    input.spaceId,
    "consultar_rutas",
  );
  if (!space) return null;
  const manage = allowsSpaceAction("activa", space.role, "gestionar_rutas");
  return {
    role: space.role,
    canManage: manage,
    routes: await dependencies.routeRepository.listRoutes(
      input.spaceId,
      !manage,
    ),
  };
}

/** Drafts are only visible to responsibles; members read published routes. */
export async function readRoute(
  dependencies: Dependencies,
  input: { identityId: string; spaceId: string; routeId: string },
): Promise<{
  canManage: boolean;
  route: RouteDetail;
  /** Responsibles only: generations left today (UTC) in the space. */
  generationsLeftToday: number | null;
} | null> {
  const space = await authorizeSpaceAction(
    dependencies.accessRepository,
    input.identityId,
    input.spaceId,
    "consultar_rutas",
  );
  if (!space) return null;
  const manage = allowsSpaceAction("activa", space.role, "gestionar_rutas");
  const route = await dependencies.routeRepository.findRoute(
    input.spaceId,
    input.routeId,
    !manage,
  );
  if (!route) return null;
  const generationsLeftToday = manage
    ? Math.max(
        0,
        routeLimits.dailyGenerationAttempts -
          (await dependencies.routeRepository.countGenerationsToday(
            input.spaceId,
          )),
      )
    : null;
  return {
    canManage: manage,
    generationsLeftToday,
    route: manage
      ? route
      : {
          ...route,
          steps: route.steps.map((step) => ({
            ...step,
            correctOption: null,
            acceptedAnswers: null,
            explanation: null,
          })),
        },
  };
}

type MutationInput = {
  identityId: string;
  spaceId: string;
  routeId: string;
  editVersion: number;
};

export async function editRouteStep(
  dependencies: Dependencies,
  // Omitting `code` removes the snippet; the editor always sends it.
  input: MutationInput & {
    stepId: string;
    edit: z.input<typeof stepEditSchema>;
  },
): Promise<RouteMutationResult> {
  const edit = stepEditSchema.safeParse(input.edit);
  if (!edit.success) return { kind: "invalid" };
  if (!(await canManage(dependencies, input.identityId, input.spaceId))) {
    return { kind: "unauthorized" };
  }
  return dependencies.routeRepository.updateStep({
    actorIdentityId: input.identityId,
    spaceId: input.spaceId,
    routeId: input.routeId,
    stepId: input.stepId,
    editVersion: input.editVersion,
    edit: edit.data,
  });
}

export async function moveRouteStep(
  dependencies: Dependencies,
  input: MutationInput & { stepId: string; direction: "up" | "down" },
): Promise<RouteMutationResult> {
  if (!(await canManage(dependencies, input.identityId, input.spaceId))) {
    return { kind: "unauthorized" };
  }
  return dependencies.routeRepository.moveStep({
    actorIdentityId: input.identityId,
    ...input,
  });
}

export async function deleteRouteStep(
  dependencies: Dependencies,
  input: MutationInput & { stepId: string },
): Promise<RouteMutationResult> {
  if (!(await canManage(dependencies, input.identityId, input.spaceId))) {
    return { kind: "unauthorized" };
  }
  return dependencies.routeRepository.deleteStep({
    actorIdentityId: input.identityId,
    ...input,
  });
}

/** Revalidates every step and requires all citations to be current. */
export async function publishRoute(
  dependencies: Dependencies,
  input: MutationInput,
): Promise<RouteMutationResult> {
  if (!(await canManage(dependencies, input.identityId, input.spaceId))) {
    return { kind: "unauthorized" };
  }
  return dependencies.routeRepository.publishRoute({
    actorIdentityId: input.identityId,
    ...input,
  });
}
