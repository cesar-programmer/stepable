import { sql, type SQL } from "drizzle-orm";

import { allowsSpaceAction } from "../../modules/access/authorization.ts";
import {
  routeLimits,
  type DraftStep,
  type GenerationClaim,
  type RequestGenerationResult,
  type RouteCitation,
  type RouteDetail,
  type RouteMutationResult,
  type RouteRepository,
  type RouteSummary,
  type StepEdit,
} from "../../modules/routes/contract.ts";
import {
  citationMarkers,
  stepEditSchema,
} from "../../modules/routes/generation.ts";

import type { StepableDatabase } from "./database.ts";

type Transaction = Parameters<
  Parameters<StepableDatabase["transaction"]>[0]
>[0];
type Executor = Pick<Transaction, "execute">;

export type RouteJobEnqueuer = {
  enqueueRouteGenerationInTransaction(
    transaction: Transaction,
    routeId: string,
    token: string,
  ): Promise<void>;
};

async function rows<T>(executor: Executor, query: SQL): Promise<T[]> {
  return (await executor.execute(query)) as unknown as T[];
}

const textArray = (values: string[]) =>
  sql`array[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::text[]`;

const uuidList = (ids: string[]) =>
  sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

// A citation is stale when its version is no longer the current one of an
// active source; computed on every read, never stored in the route.
const citationState = sql`
  case
    when source.status <> 'activa' then 'fuente_eliminada'
    when citation.version_id <> source.current_version_id then 'version_anterior'
    else 'vigente'
  end
`;

const needsReview = sql`exists (
  select 1 from public.route_steps step
  join public.route_citations citation on citation.step_id = step.id
  join public.sources source on source.id = citation.source_id
  where step.route_id = route.id
    and (source.status <> 'activa'
      or citation.version_id <> source.current_version_id)
)`;

type SummaryRow = {
  id: string;
  title: string | null;
  objective: string;
  status: RouteSummary["status"];
  generation_status: RouteSummary["generationStatus"];
  generation_error: string | null;
  needs_review: boolean;
  updated_at: Date;
  edit_version: number;
  published_at: Date | null;
};

function toSummary(row: SummaryRow): RouteSummary {
  return {
    id: row.id,
    title: row.title,
    objective: row.objective,
    status: row.status,
    generationStatus: row.generation_status,
    generationError: row.generation_error,
    needsReview: row.needs_review,
    updatedAt: new Date(row.updated_at),
  };
}

async function lockAndAuthorize(
  transaction: Transaction,
  spaceId: string,
  actorIdentityId: string,
): Promise<boolean> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`routes:${spaceId}`}, 0))`,
  );
  const [actor] = await rows<{ role: string; status: string }>(
    transaction,
    sql`select role, status from public.memberships
        where space_id = ${spaceId} and profile_id = ${actorIdentityId}`,
  );
  return Boolean(
    actor && allowsSpaceAction(actor.status, actor.role, "gestionar_rutas"),
  );
}

// Attempts already made today (UTC) plus generations still queued or running.
async function dailyLimitReached(
  transaction: Transaction,
  spaceId: string,
): Promise<boolean> {
  const [row] = await rows<{ used: number }>(
    transaction,
    sql`select
      (select count(*) from public.route_generation_attempts
        where space_id = ${spaceId}
          and attempted_at >= date_trunc('day', now(), 'UTC'))::int
      + (select count(*) from public.routes
        where space_id = ${spaceId}
          and generation_status in ('en_cola', 'generando'))::int as used`,
  );
  return row.used >= routeLimits.dailyGenerationAttempts;
}

type EditableRoute = {
  status: string;
  generation_status: string;
  edit_version: number;
};

async function lockEditableRoute(
  transaction: Transaction,
  spaceId: string,
  routeId: string,
  editVersion: number,
): Promise<RouteMutationResult | null> {
  const [route] = await rows<EditableRoute>(
    transaction,
    sql`select status, generation_status, edit_version from public.routes
        where id = ${routeId} and space_id = ${spaceId} for update`,
  );
  if (!route) return { kind: "not_found" };
  if (route.status !== "borrador" || route.generation_status !== "lista") {
    return { kind: "not_editable" };
  }
  if (route.edit_version !== editVersion) return { kind: "conflict" };
  return null;
}

async function bumpVersion(transaction: Transaction, routeId: string) {
  await transaction.execute(
    sql`update public.routes
        set edit_version = edit_version + 1, updated_at = now()
        where id = ${routeId}`,
  );
}

export class PostgresRouteRepository implements RouteRepository {
  private readonly database: StepableDatabase;
  private readonly queue: RouteJobEnqueuer | null;
  /**
   * When set (worker side), only content of spaces in this job namespace is
   * processed, so a worker never touches data created by another environment.
   */
  private readonly jobNamespace: string | null;

  constructor(
    database: StepableDatabase,
    queue: RouteJobEnqueuer | null,
    options: { jobNamespace?: string } = {},
  ) {
    this.database = database;
    this.queue = queue;
    this.jobNamespace = options.jobNamespace ?? null;
  }

  private requireQueue(): RouteJobEnqueuer {
    if (!this.queue) {
      throw new Error("Esta operación requiere una cola configurada.");
    }
    return this.queue;
  }

  async createRoute(input: {
    routeId: string;
    actorIdentityId: string;
    spaceId: string;
    objective: string;
    sourceIds: string[];
    token: string;
  }): Promise<RequestGenerationResult> {
    const queue = this.requireQueue();
    return this.database.transaction(async (transaction) => {
      if (
        !(await lockAndAuthorize(
          transaction,
          input.spaceId,
          input.actorIdentityId,
        ))
      ) {
        return { kind: "unauthorized" as const };
      }
      const [available] = await rows<{ count: number }>(
        transaction,
        sql`select count(*)::int as count from public.sources source
            join public.source_versions version
              on version.id = source.current_version_id and version.status = 'lista'
            where source.space_id = ${input.spaceId}
              and source.status = 'activa'
              and source.id in (${uuidList(input.sourceIds)})`,
      );
      if (available.count !== input.sourceIds.length) {
        return { kind: "fuentes_no_disponibles" as const };
      }
      if (await dailyLimitReached(transaction, input.spaceId)) {
        return { kind: "limite_diario" as const };
      }

      await transaction.execute(
        sql`insert into public.routes
              (id, space_id, objective, generation_token, created_by)
            values (${input.routeId}, ${input.spaceId}, ${input.objective},
              ${input.token}, ${input.actorIdentityId})`,
      );
      await transaction.execute(
        sql`insert into public.route_sources (route_id, space_id, source_id)
            select ${input.routeId}::uuid, ${input.spaceId}::uuid, id
            from unnest(array[${uuidList(input.sourceIds)}]) as id`,
      );
      await queue.enqueueRouteGenerationInTransaction(
        transaction,
        input.routeId,
        input.token,
      );
      return { kind: "queued" as const, routeId: input.routeId };
    });
  }

  async requestRegeneration(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    token: string;
  }): Promise<RequestGenerationResult> {
    const queue = this.requireQueue();
    return this.database.transaction(async (transaction) => {
      if (
        !(await lockAndAuthorize(
          transaction,
          input.spaceId,
          input.actorIdentityId,
        ))
      ) {
        return { kind: "unauthorized" as const };
      }
      const [route] = await rows<EditableRoute>(
        transaction,
        sql`select status, generation_status, edit_version from public.routes
            where id = ${input.routeId} and space_id = ${input.spaceId}
            for update`,
      );
      if (!route) return { kind: "not_found" as const };
      if (route.status !== "borrador") return { kind: "not_editable" as const };
      if (["en_cola", "generando"].includes(route.generation_status)) {
        return { kind: "generacion_en_curso" as const };
      }
      if (await dailyLimitReached(transaction, input.spaceId)) {
        return { kind: "limite_diario" as const };
      }

      // Regenerating replaces the previous draft entirely.
      await transaction.execute(
        sql`delete from public.route_steps where route_id = ${input.routeId}`,
      );
      await transaction.execute(
        sql`update public.routes
            set generation_status = 'en_cola', generation_token = ${input.token},
              generation_error = null, generation_started_at = null, title = null,
              edit_version = edit_version + 1, updated_at = now()
            where id = ${input.routeId}`,
      );
      await queue.enqueueRouteGenerationInTransaction(
        transaction,
        input.routeId,
        input.token,
      );
      return { kind: "queued" as const, routeId: input.routeId };
    });
  }

  async claimGeneration(
    routeId: string,
    token: string,
  ): Promise<GenerationClaim | null> {
    const [route] = await rows<{ space_id: string; objective: string }>(
      this.database,
      sql`update public.routes
          set generation_status = 'generando', generation_started_at = now(),
            updated_at = now()
          where id = ${routeId} and generation_token = ${token}
            and generation_status = 'en_cola' and status = 'borrador'
            ${
              this.jobNamespace
                ? sql`and exists (
                    select 1 from public.spaces space
                    where space.id = routes.space_id
                      and space.job_namespace = ${this.jobNamespace})`
                : sql``
            }
          returning space_id, objective`,
    );
    if (!route) return null;
    const sources = await rows<{ source_id: string }>(
      this.database,
      sql`select source_id from public.route_sources where route_id = ${routeId}`,
    );
    return {
      routeId,
      spaceId: route.space_id,
      objective: route.objective,
      sourceIds: sources.map((source) => source.source_id),
    };
  }

  async reserveGenerationAttempt(
    spaceId: string,
    routeId: string,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`route-attempts:${spaceId}`}, 0))`,
      );
      const [row] = await rows<{ count: number }>(
        transaction,
        sql`select count(*)::int as count from public.route_generation_attempts
            where space_id = ${spaceId}
              and attempted_at >= date_trunc('day', now(), 'UTC')`,
      );
      if (row.count >= routeLimits.dailyGenerationAttempts) return false;
      await transaction.execute(
        sql`insert into public.route_generation_attempts (space_id, route_id)
            values (${spaceId}, ${routeId})`,
      );
      return true;
    });
  }

  async finishGeneration(input: {
    routeId: string;
    token: string;
    status: "lista" | "insuficiente" | "fallida";
    errorCode?: string;
    title?: string;
    steps?: DraftStep[];
  }): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [route] = await rows<{ space_id: string }>(
        transaction,
        sql`select space_id from public.routes
            where id = ${input.routeId} and generation_token = ${input.token}
              and generation_status = 'generando' and status = 'borrador'
            for update`,
      );
      if (!route) return false;

      if (input.status === "lista") {
        for (const step of input.steps ?? []) {
          const [inserted] = await rows<{ id: string }>(
            transaction,
            sql`insert into public.route_steps
                  (route_id, position, title, lesson, question, options,
                   correct_option, explanation)
                values (${input.routeId}, ${step.position}, ${step.title},
                  ${step.lesson}, ${step.question}, ${textArray(step.options)},
                  ${step.correctOption}, ${step.explanation})
                returning id`,
          );
          for (const citation of step.citations) {
            await transaction.execute(
              sql`insert into public.route_citations
                    (step_id, ref, space_id, source_id, version_id,
                     version_number, source_title, location)
                  values (${inserted.id}, ${citation.ref}, ${route.space_id},
                    ${citation.sourceId}, ${citation.versionId},
                    ${citation.versionNumber}, ${citation.sourceTitle},
                    ${citation.location})`,
            );
          }
        }
      }
      await transaction.execute(
        sql`update public.routes
            set generation_status = ${input.status}::public.route_generation_status,
              generation_error = ${input.errorCode ?? null},
              title = ${input.title ?? null},
              edit_version = edit_version + 1, updated_at = now()
            where id = ${input.routeId}`,
      );
      return true;
    });
  }

  async failStaleGenerations(startedBefore: Date): Promise<number> {
    const updated = await rows<{ id: string }>(
      this.database,
      sql`update public.routes
          set generation_status = 'fallida', generation_error = 'tiempo_agotado',
            updated_at = now()
          where generation_status = 'generando'
            and generation_started_at < ${startedBefore.toISOString()}::timestamptz
          returning id`,
    );
    return updated.length;
  }

  async listRoutes(
    spaceId: string,
    onlyPublished: boolean,
  ): Promise<RouteSummary[]> {
    const routes = await rows<SummaryRow>(
      this.database,
      sql`select route.id, route.title, route.objective, route.status,
            route.generation_status, route.generation_error, route.updated_at,
            route.edit_version, route.published_at, ${needsReview} as needs_review
          from public.routes route
          where route.space_id = ${spaceId}
            ${onlyPublished ? sql`and route.status = 'publicada'` : sql``}
          order by route.created_at desc, route.id`,
    );
    return routes.map(toSummary);
  }

  async findRoute(
    spaceId: string,
    routeId: string,
    onlyPublished: boolean,
  ): Promise<RouteDetail | null> {
    const [route] = await rows<SummaryRow>(
      this.database,
      sql`select route.id, route.title, route.objective, route.status,
            route.generation_status, route.generation_error, route.updated_at,
            route.edit_version, route.published_at, ${needsReview} as needs_review
          from public.routes route
          where route.id = ${routeId} and route.space_id = ${spaceId}
            ${onlyPublished ? sql`and route.status = 'publicada'` : sql``}`,
    );
    if (!route) return null;

    const sources = await rows<{
      id: string;
      title: string | null;
      active: boolean;
    }>(
      this.database,
      sql`select source.id, source.title, source.status = 'activa' as active
          from public.route_sources selected
          join public.sources source on source.id = selected.source_id
          where selected.route_id = ${routeId}
          order by source.title`,
    );
    const steps = await rows<{
      id: string;
      position: number;
      title: string;
      lesson: string;
      question: string;
      options: string[];
      correct_option: number;
      explanation: string;
    }>(
      this.database,
      sql`select id, position, title, lesson, question, options, correct_option,
            explanation
          from public.route_steps where route_id = ${routeId}
          order by position`,
    );
    const citations = await rows<{
      step_id: string;
      ref: number;
      source_id: string;
      version_id: string;
      version_number: number;
      source_title: string;
      location: string;
      state: RouteCitation["state"];
      current_version_number: number | null;
    }>(
      this.database,
      sql`select citation.step_id, citation.ref, citation.source_id,
            citation.version_id, citation.version_number, citation.source_title,
            citation.location, ${citationState} as state,
            case when source.status = 'activa' then current_version.number end
              as current_version_number
          from public.route_citations citation
          join public.route_steps step on step.id = citation.step_id
          join public.sources source on source.id = citation.source_id
          left join public.source_versions current_version
            on current_version.id = source.current_version_id
          where step.route_id = ${routeId}
          order by citation.ref`,
    );

    return {
      ...toSummary(route),
      editVersion: route.edit_version,
      publishedAt: route.published_at ? new Date(route.published_at) : null,
      sources,
      steps: steps.map((step) => ({
        id: step.id,
        position: step.position,
        title: step.title,
        lesson: step.lesson,
        question: step.question,
        options: step.options,
        correctOption: step.correct_option,
        explanation: step.explanation,
        citations: citations
          .filter((citation) => citation.step_id === step.id)
          .map((citation) => ({
            ref: citation.ref,
            sourceId: citation.source_id,
            versionId: citation.version_id,
            versionNumber: citation.version_number,
            sourceTitle: citation.source_title,
            location: citation.location,
            state: citation.state,
            currentVersionNumber: citation.current_version_number,
          })),
      })),
    };
  }

  private mutate(
    input: {
      actorIdentityId: string;
      spaceId: string;
      routeId: string;
      editVersion: number;
    },
    body: (transaction: Transaction) => Promise<RouteMutationResult>,
  ): Promise<RouteMutationResult> {
    return this.database.transaction(async (transaction) => {
      if (
        !(await lockAndAuthorize(
          transaction,
          input.spaceId,
          input.actorIdentityId,
        ))
      ) {
        return { kind: "unauthorized" };
      }
      const blocked = await lockEditableRoute(
        transaction,
        input.spaceId,
        input.routeId,
        input.editVersion,
      );
      if (blocked) return blocked;
      const result = await body(transaction);
      if (result.kind === "ok") await bumpVersion(transaction, input.routeId);
      return result;
    });
  }

  updateStep(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    editVersion: number;
    edit: StepEdit;
  }): Promise<RouteMutationResult> {
    return this.mutate(input, async (transaction) => {
      const refs = await rows<{ ref: number }>(
        transaction,
        sql`select citation.ref from public.route_citations citation
            join public.route_steps step on step.id = citation.step_id
            where step.id = ${input.stepId} and step.route_id = ${input.routeId}`,
      );
      const [step] = await rows<{ id: string }>(
        transaction,
        sql`select id from public.route_steps
            where id = ${input.stepId} and route_id = ${input.routeId}`,
      );
      if (!step) return { kind: "not_found" };
      const allowed = new Set(refs.map((row) => row.ref));
      if (citationMarkers(input.edit.lesson).some((ref) => !allowed.has(ref))) {
        return { kind: "invalid" };
      }
      await transaction.execute(
        sql`update public.route_steps
            set title = ${input.edit.title}, lesson = ${input.edit.lesson},
              question = ${input.edit.question},
              options = ${textArray(input.edit.options)},
              correct_option = ${input.edit.correctOption},
              explanation = ${input.edit.explanation}
            where id = ${input.stepId}`,
      );
      return { kind: "ok" };
    });
  }

  moveStep(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    editVersion: number;
    direction: "up" | "down";
  }): Promise<RouteMutationResult> {
    return this.mutate(input, async (transaction) => {
      const [step] = await rows<{ position: number }>(
        transaction,
        sql`select position from public.route_steps
            where id = ${input.stepId} and route_id = ${input.routeId}`,
      );
      if (!step) return { kind: "not_found" };
      const target = step.position + (input.direction === "up" ? -1 : 1);
      // Positions are unique but deferred, so the swap commits atomically.
      const swapped = await rows<{ id: string }>(
        transaction,
        sql`update public.route_steps set position = ${step.position}
            where route_id = ${input.routeId} and position = ${target}
            returning id`,
      );
      if (swapped.length === 0) return { kind: "invalid" };
      await transaction.execute(
        sql`update public.route_steps set position = ${target}
            where id = ${input.stepId}`,
      );
      return { kind: "ok" };
    });
  }

  deleteStep(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    stepId: string;
    editVersion: number;
  }): Promise<RouteMutationResult> {
    return this.mutate(input, async (transaction) => {
      const [deleted] = await rows<{ position: number }>(
        transaction,
        sql`delete from public.route_steps
            where id = ${input.stepId} and route_id = ${input.routeId}
            returning position`,
      );
      if (!deleted) return { kind: "not_found" };
      await transaction.execute(
        sql`update public.route_steps set position = position - 1
            where route_id = ${input.routeId} and position > ${deleted.position}`,
      );
      return { kind: "ok" };
    });
  }

  publishRoute(input: {
    actorIdentityId: string;
    spaceId: string;
    routeId: string;
    editVersion: number;
  }): Promise<RouteMutationResult> {
    return this.database.transaction(async (transaction) => {
      if (
        !(await lockAndAuthorize(
          transaction,
          input.spaceId,
          input.actorIdentityId,
        ))
      ) {
        return { kind: "unauthorized" };
      }
      const blocked = await lockEditableRoute(
        transaction,
        input.spaceId,
        input.routeId,
        input.editVersion,
      );
      if (blocked) return blocked;

      const route = await this.findRoute(input.spaceId, input.routeId, false);
      if (!route) return { kind: "not_found" };
      if (route.steps.length === 0) return { kind: "sin_pasos" };
      for (const step of route.steps) {
        const refs = new Set(step.citations.map((citation) => citation.ref));
        if (
          !stepEditSchema.safeParse(step).success ||
          refs.size === 0 ||
          citationMarkers(step.lesson).some((ref) => !refs.has(ref))
        ) {
          return { kind: "invalid" };
        }
        // Never publish an old reference as if it were current.
        if (step.citations.some((citation) => citation.state !== "vigente")) {
          return { kind: "citas_no_vigentes" };
        }
      }
      await transaction.execute(
        sql`update public.routes
            set status = 'publicada', published_by = ${input.actorIdentityId},
              published_at = now(), edit_version = edit_version + 1,
              updated_at = now()
            where id = ${input.routeId}`,
      );
      return { kind: "ok" };
    });
  }
}
