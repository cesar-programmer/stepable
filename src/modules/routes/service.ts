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

import {
  routeLimits,
  type DraftStep,
  type RequestGenerationResult,
  type RouteDetail,
  type RouteListing,
  type RouteMutationResult,
  type RouteRepository,
  type StepEdit,
} from "./contract.ts";
import {
  buildRoutePrompt,
  parseGeneratedRoute,
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
    sourceIds: parsed.data.sourceIds,
    token: randomUUID(),
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
    log?: (entry: Record<string, unknown>) => void;
  },
  input: { routeId: string; token: string },
): Promise<GenerationOutcome> {
  const repository = dependencies.routeRepository;
  const claim = await repository.claimGeneration(input.routeId, input.token);
  if (!claim) return "omitida";
  const finish = async (
    status: "lista" | "insuficiente" | "fallida",
    extra: { errorCode?: string; title?: string; steps?: DraftStep[] } = {},
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
  let semantic: typeof lexical = [];
  if (dependencies.embedder) {
    try {
      const [values] = await dependencies.embedder.embed([claim.objective]);
      semantic = await dependencies.knowledgeRepository.searchSemantic(
        claim.spaceId,
        { model: dependencies.embedder.model, values },
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
  if (
    !(await repository.reserveGenerationAttempt(claim.spaceId, claim.routeId))
  ) {
    return finish("fallida", { errorCode: "limite_diario" });
  }

  let completion;
  const startedAt = Date.now();
  try {
    completion = await dependencies.chatModel.complete({
      ...buildRoutePrompt(claim.objective, fragments),
      maxOutputTokens: routeLimits.maxOutputTokens,
    });
  } catch {
    return finish("fallida", { errorCode: "modelo_no_disponible" });
  }
  const parsed = parseGeneratedRoute(completion.text, fragments);
  dependencies.log?.({
    event: "route_generation",
    routeId: claim.routeId,
    spaceId: claim.spaceId,
    outcome: parsed.kind,
    fragments: fragments.length,
    usage: completion.usage,
    durationMs: Date.now() - startedAt,
  });
  if (parsed.kind === "insufficient") return finish("insuficiente");
  if (parsed.kind === "invalid") {
    return finish("fallida", { errorCode: "borrador_no_valido" });
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
): Promise<{ canManage: boolean; route: RouteDetail } | null> {
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
  return {
    canManage: manage,
    route: manage
      ? route
      : {
          ...route,
          steps: route.steps.map((step) => ({
            ...step,
            correctOption: null,
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
  input: MutationInput & { stepId: string; edit: StepEdit },
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
