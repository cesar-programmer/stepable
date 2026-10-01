import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { allowsSpaceAction } from "../../modules/access/authorization.ts";
import {
  maxActiveSourcesPerSpace,
  maxManualRetries,
  type CreateReplacementResult,
  type CreateSourceResult,
  type DeleteSourceResult,
  type PurgeTarget,
  type NewReplacementVersion,
  type NewSourceVersion,
  type ProcessingErrorCode,
  type RetryVersionResult,
  type SourceRepository,
  type SourceSection,
  type SourceSummary,
  type VersionForProcessing,
} from "../../modules/sources/contract.ts";

import { recordAccessAuditEvent } from "./access-audit.ts";
import type { StepableDatabase } from "./database.ts";
import {
  memberships,
  sourceSegments,
  sourceVersions,
  sources,
  spaces,
} from "./schema.ts";

type Transaction = Parameters<
  Parameters<StepableDatabase["transaction"]>[0]
>[0];

export type SourceJobEnqueuer = {
  enqueueInTransaction(
    transaction: Transaction,
    versionId: string,
  ): Promise<void>;
  enqueuePurgeInTransaction(
    transaction: Transaction,
    sourceId: string,
  ): Promise<void>;
};

function auditSource(
  transaction: Transaction,
  action:
    | "fuente_cargada"
    | "fuente_reemplazada"
    | "procesamiento_reintentado"
    | "fuente_eliminada",
  input: { actorIdentityId: string; spaceId: string; sourceId: string },
) {
  return recordAccessAuditEvent(transaction, {
    action,
    actor: { type: "identidad", profileId: input.actorIdentityId },
    spaceId: input.spaceId,
    targetType: "fuente",
    targetId: input.sourceId,
  });
}

const segmentBatchSize = 500;
const inProgressStatuses = ["en_cola", "procesando"] as const;

const currentVersion = alias(sourceVersions, "current_version");
const latestVersion = alias(sourceVersions, "latest_version");

function versionColumns(version: typeof currentVersion | typeof latestVersion) {
  return {
    id: version.id,
    number: version.number,
    format: version.format,
    status: version.status,
    errorCode: version.errorCode,
    sectionCount: version.sectionCount,
    pageCount: version.pageCount,
    manualRetries: version.manualRetries,
    updatedAt: version.updatedAt,
  };
}

type VersionRow = {
  id: string;
  number: number;
  format: SourceSummary["format"];
  status: SourceSummary["status"];
  errorCode: string | null;
  sectionCount: number | null;
  pageCount: number | null;
  manualRetries: number;
  updatedAt: Date;
};

type NullableVersionRow = { [Key in keyof VersionRow]: VersionRow[Key] | null };

function toSummary(
  row: {
    id: string;
    title: string | null;
    current: NullableVersionRow | null;
    latest: NullableVersionRow;
  },
  onlyReady: boolean,
): SourceSummary {
  // A left-joined alias comes back with nullable columns; the inner join
  // guarantees the latest version and current_version_id the current one.
  const current = row.current?.id ? (row.current as VersionRow) : null;
  const latest = row.latest as VersionRow;
  const displayed = current ?? latest;
  const pending =
    !onlyReady &&
    current &&
    latest.id !== current.id &&
    ["en_cola", "procesando", "fallida"].includes(latest.status)
      ? latest
      : null;

  return {
    id: row.id,
    // Only deleted sources lose their title (sources_title_required).
    title: row.title ?? "",
    format: displayed.format,
    versionNumber: displayed.number,
    status: displayed.status,
    errorCode: displayed.errorCode,
    sectionCount: displayed.sectionCount,
    pageCount: displayed.pageCount,
    manualRetries: displayed.manualRetries,
    updatedAt: displayed.updatedAt,
    pending: pending && {
      versionNumber: pending.number,
      format: pending.format,
      status: pending.status,
      errorCode: pending.errorCode,
      manualRetries: pending.manualRetries,
    },
  };
}

// Serializes source mutations per space and revalidates the actor inside the
// transaction, as E1.7 does for access mutations.
async function lockAndAuthorize(
  transaction: Transaction,
  spaceId: string,
  actorIdentityId: string,
): Promise<boolean> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`sources:${spaceId}`}, 0))`,
  );
  const [actor] = await transaction
    .select({ role: memberships.role, status: memberships.status })
    .from(memberships)
    .where(
      and(
        eq(memberships.spaceId, spaceId),
        eq(memberships.profileId, actorIdentityId),
      ),
    )
    .limit(1);
  return Boolean(
    actor && allowsSpaceAction(actor.status, actor.role, "gestionar_fuentes"),
  );
}

export class PostgresSourceRepository implements SourceRepository {
  private readonly database: StepableDatabase;
  private readonly queue: SourceJobEnqueuer | null;
  /**
   * When set (worker side), only content of spaces in this job namespace is
   * processed, so a worker never touches data created by another environment.
   */
  private readonly jobNamespace: string | null;

  constructor(
    database: StepableDatabase,
    queue: SourceJobEnqueuer | null,
    options: { jobNamespace?: string } = {},
  ) {
    this.database = database;
    this.queue = queue;
    this.jobNamespace = options.jobNamespace ?? null;
  }

  private requireQueue(): SourceJobEnqueuer {
    if (!this.queue) {
      throw new Error("Esta operación requiere una cola configurada.");
    }
    return this.queue;
  }

  async createSourceWithFirstVersion(
    input: NewSourceVersion,
  ): Promise<CreateSourceResult> {
    const queue = this.requireQueue();

    return this.database.transaction(async (transaction) => {
      if (
        !(await lockAndAuthorize(transaction, input.spaceId, input.createdBy))
      ) {
        return { kind: "unauthorized" as const };
      }

      const [{ count }] = await transaction
        .select({ count: sql<number>`count(*)::int` })
        .from(sources)
        .where(
          and(eq(sources.spaceId, input.spaceId), eq(sources.status, "activa")),
        );
      if (count >= maxActiveSourcesPerSpace) {
        return { kind: "limite_de_fuentes" as const };
      }

      await transaction.insert(sources).values({
        id: input.sourceId,
        spaceId: input.spaceId,
        title: input.title,
        createdBy: input.createdBy,
      });
      await transaction.insert(sourceVersions).values({
        id: input.versionId,
        sourceId: input.sourceId,
        spaceId: input.spaceId,
        number: 1,
        format: input.format,
        byteSize: input.byteSize,
        sha256: input.sha256,
        storageKey: input.storageKey,
        createdBy: input.createdBy,
      });
      await queue.enqueueInTransaction(transaction, input.versionId);
      await auditSource(transaction, "fuente_cargada", {
        actorIdentityId: input.createdBy,
        spaceId: input.spaceId,
        sourceId: input.sourceId,
      });

      return { kind: "created" as const };
    });
  }

  async createReplacementVersion(
    input: NewReplacementVersion,
  ): Promise<CreateReplacementResult> {
    const queue = this.requireQueue();

    return this.database.transaction(async (transaction) => {
      if (
        !(await lockAndAuthorize(transaction, input.spaceId, input.createdBy))
      ) {
        return { kind: "unauthorized" as const };
      }

      const [source] = await transaction
        .select({ currentVersionId: sources.currentVersionId })
        .from(sources)
        .where(
          and(
            eq(sources.id, input.sourceId),
            eq(sources.spaceId, input.spaceId),
            eq(sources.status, "activa"),
          ),
        )
        .limit(1)
        .for("update");
      if (!source) return { kind: "not_found" as const };

      const versions = await transaction
        .select({
          id: sourceVersions.id,
          number: sourceVersions.number,
          status: sourceVersions.status,
          sha256: sourceVersions.sha256,
        })
        .from(sourceVersions)
        .where(eq(sourceVersions.sourceId, input.sourceId))
        .orderBy(desc(sourceVersions.number));
      if (
        versions.some((version) =>
          (inProgressStatuses as readonly string[]).includes(version.status),
        )
      ) {
        return { kind: "reemplazo_en_curso" as const };
      }
      const current = versions.find(
        (version) => version.id === source.currentVersionId,
      );
      if (current?.sha256 === input.sha256) {
        return { kind: "sin_cambios" as const };
      }

      // A failed version that is not current is superseded, never deleted.
      await transaction
        .update(sourceVersions)
        .set({ status: "descartada", errorCode: null, updatedAt: sql`now()` })
        .where(
          and(
            eq(sourceVersions.sourceId, input.sourceId),
            eq(sourceVersions.status, "fallida"),
          ),
        );

      const versionNumber = (versions[0]?.number ?? 0) + 1;
      await transaction.insert(sourceVersions).values({
        id: input.versionId,
        sourceId: input.sourceId,
        spaceId: input.spaceId,
        number: versionNumber,
        format: input.format,
        byteSize: input.byteSize,
        sha256: input.sha256,
        storageKey: input.storageKey,
        createdBy: input.createdBy,
      });
      await queue.enqueueInTransaction(transaction, input.versionId);
      await auditSource(transaction, "fuente_reemplazada", {
        actorIdentityId: input.createdBy,
        spaceId: input.spaceId,
        sourceId: input.sourceId,
      });

      return { kind: "created" as const, versionNumber };
    });
  }

  async retryFailedVersion(input: {
    actorIdentityId: string;
    spaceId: string;
    sourceId: string;
  }): Promise<RetryVersionResult> {
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

      const [latest] = await transaction
        .select({
          id: sourceVersions.id,
          number: sourceVersions.number,
          status: sourceVersions.status,
          manualRetries: sourceVersions.manualRetries,
        })
        .from(sourceVersions)
        .innerJoin(sources, eq(sources.id, sourceVersions.sourceId))
        .where(
          and(
            eq(sources.id, input.sourceId),
            eq(sources.spaceId, input.spaceId),
            eq(sources.status, "activa"),
          ),
        )
        .orderBy(desc(sourceVersions.number))
        .limit(1)
        .for("update", { of: sourceVersions });
      if (!latest) return { kind: "not_found" as const };
      if (latest.status === "en_cola" || latest.status === "procesando") {
        return { kind: "already_queued" as const };
      }
      if (latest.status !== "fallida") {
        return { kind: "not_retryable" as const };
      }
      if (latest.manualRetries >= maxManualRetries) {
        return { kind: "limite_de_reintentos" as const };
      }

      await transaction
        .update(sourceVersions)
        .set({
          status: "en_cola",
          errorCode: null,
          manualRetries: latest.manualRetries + 1,
          updatedAt: sql`now()`,
        })
        .where(eq(sourceVersions.id, latest.id));
      await queue.enqueueInTransaction(transaction, latest.id);
      await auditSource(transaction, "procesamiento_reintentado", input);

      return { kind: "queued" as const, versionNumber: latest.number };
    });
  }

  async deleteSource(input: {
    actorIdentityId: string;
    spaceId: string;
    sourceId: string;
  }): Promise<DeleteSourceResult> {
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

      const [source] = await transaction
        .select({ id: sources.id })
        .from(sources)
        .where(
          and(
            eq(sources.id, input.sourceId),
            eq(sources.spaceId, input.spaceId),
            eq(sources.status, "activa"),
          ),
        )
        .limit(1)
        .for("update");
      if (!source) return { kind: "not_found" as const };

      // Every read filters by status "activa", so the source disappears for
      // both roles as soon as this commits; the worker purges its content.
      await transaction
        .update(sources)
        .set({
          status: "eliminada",
          deletedAt: sql`now()`,
          deletedBy: input.actorIdentityId,
          purgeRequestedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(sources.id, input.sourceId));
      await auditSource(transaction, "fuente_eliminada", input);
      await queue.enqueuePurgeInTransaction(transaction, input.sourceId);

      return { kind: "deleted" as const };
    });
  }

  async findPurgeTarget(sourceId: string): Promise<PurgeTarget | null> {
    const [source] = await this.database
      .select({ id: sources.id })
      .from(sources)
      .where(
        and(
          eq(sources.id, sourceId),
          eq(sources.status, "eliminada"),
          isNull(sources.purgedAt),
        ),
      )
      .limit(1);
    if (!source) return null;

    const versions = await this.database
      .select({ storageKey: sourceVersions.storageKey })
      .from(sourceVersions)
      .where(eq(sourceVersions.sourceId, sourceId));
    return { storageKeys: versions.map((version) => version.storageKey) };
  }

  /**
   * Removes extracted text and content-derived metadata of a deleted source.
   * Identifiers, version numbers, states and dates remain for cleanup and
   * audit; title and SHA-256 are cleared.
   */
  async completePurge(sourceId: string): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [source] = await transaction
        .select({ id: sources.id })
        .from(sources)
        .where(
          and(
            eq(sources.id, sourceId),
            eq(sources.status, "eliminada"),
            isNull(sources.purgedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (!source) return false;

      await transaction
        .delete(sourceSegments)
        .where(
          inArray(
            sourceSegments.versionId,
            transaction
              .select({ id: sourceVersions.id })
              .from(sourceVersions)
              .where(eq(sourceVersions.sourceId, sourceId)),
          ),
        );
      await transaction
        .update(sourceVersions)
        .set({ sha256: null, updatedAt: sql`now()` })
        .where(eq(sourceVersions.sourceId, sourceId));
      await transaction
        .update(sources)
        .set({ title: null, purgedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(sources.id, sourceId));
      return true;
    });
  }

  async claimStalePurges(requestedBefore: Date): Promise<string[]> {
    const claimed = await this.database
      .update(sources)
      .set({ purgeRequestedAt: sql`now()` })
      .where(
        and(
          eq(sources.status, "eliminada"),
          isNull(sources.purgedAt),
          lt(sources.purgeRequestedAt, requestedBefore),
        ),
      )
      .returning({ id: sources.id });
    return claimed.map((source) => source.id);
  }

  private selectSummaries(condition: SQL | undefined) {
    return this.database
      .select({
        id: sources.id,
        title: sources.title,
        current: versionColumns(currentVersion),
        latest: versionColumns(latestVersion),
      })
      .from(sources)
      .innerJoin(
        latestVersion,
        and(
          eq(latestVersion.sourceId, sources.id),
          sql`${latestVersion.number} = (
            select max(candidate.number) from public.source_versions candidate
            where candidate.source_id = ${sources.id}
          )`,
        ),
      )
      .leftJoin(currentVersion, eq(currentVersion.id, sources.currentVersionId))
      .where(condition);
  }

  async listSources(
    spaceId: string,
    onlyReady: boolean,
  ): Promise<SourceSummary[]> {
    const rows = await this.selectSummaries(
      and(
        eq(sources.spaceId, spaceId),
        eq(sources.status, "activa"),
        onlyReady ? isNotNull(sources.currentVersionId) : undefined,
      ),
    ).orderBy(asc(sources.title), asc(sources.id));
    return rows.map((row) => toSummary(row, onlyReady));
  }

  async findSource(
    spaceId: string,
    sourceId: string,
    onlyReady: boolean,
  ): Promise<SourceSummary | null> {
    const [row] = await this.selectSummaries(
      and(
        eq(sources.id, sourceId),
        eq(sources.spaceId, spaceId),
        eq(sources.status, "activa"),
        onlyReady ? isNotNull(sources.currentVersionId) : undefined,
      ),
    ).limit(1);
    return row ? toSummary(row, onlyReady) : null;
  }

  async listCurrentSections(
    spaceId: string,
    sourceId: string,
  ): Promise<SourceSection[]> {
    return this.database
      .select({
        ordinal: sourceSegments.ordinal,
        headingPath: sourceSegments.headingPath,
        startLine: sourceSegments.startLine,
        endLine: sourceSegments.endLine,
        pageNumber: sourceSegments.pageNumber,
        content: sourceSegments.content,
      })
      .from(sourceSegments)
      .innerJoin(
        sources,
        eq(sources.currentVersionId, sourceSegments.versionId),
      )
      .where(
        and(
          eq(sources.id, sourceId),
          eq(sources.spaceId, spaceId),
          eq(sources.status, "activa"),
        ),
      )
      .orderBy(asc(sourceSegments.ordinal));
  }

  async startProcessing(
    versionId: string,
  ): Promise<VersionForProcessing | null> {
    return this.database.transaction(async (transaction) => {
      const [version] = await transaction
        .select({
          versionId: sourceVersions.id,
          spaceId: sourceVersions.spaceId,
          storageKey: sourceVersions.storageKey,
          format: sourceVersions.format,
          status: sourceVersions.status,
          sourceStatus: sources.status,
        })
        .from(sourceVersions)
        .innerJoin(sources, eq(sources.id, sourceVersions.sourceId))
        .innerJoin(spaces, eq(spaces.id, sources.spaceId))
        .where(
          and(
            eq(sourceVersions.id, versionId),
            this.jobNamespace
              ? eq(spaces.jobNamespace, this.jobNamespace)
              : undefined,
          ),
        )
        .limit(1)
        .for("update", { of: sourceVersions });

      if (
        !version ||
        version.sourceStatus !== "activa" ||
        (version.status !== "en_cola" && version.status !== "procesando")
      ) {
        return null;
      }

      await transaction
        .update(sourceVersions)
        .set({
          status: "procesando",
          attempts: sql`${sourceVersions.attempts} + 1`,
          updatedAt: sql`now()`,
        })
        .where(eq(sourceVersions.id, versionId));

      return {
        versionId: version.versionId,
        spaceId: version.spaceId,
        storageKey: version.storageKey,
        format: version.format,
      };
    });
  }

  async completeProcessing(
    versionId: string,
    sections: SourceSection[],
    pageCount: number | null,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      // Lock the source before the version, in the same order as deletion,
      // so a committed deletion always prevents republishing.
      const [source] = await transaction
        .select({
          id: sources.id,
          status: sources.status,
          currentVersionId: sources.currentVersionId,
        })
        .from(sources)
        .where(
          sql`${sources.id} = (
            select version.source_id from public.source_versions version
            where version.id = ${versionId}
          )`,
        )
        .limit(1)
        .for("update");
      if (!source || source.status !== "activa") return false;

      const [version] = await transaction
        .select({ sourceId: sourceVersions.sourceId })
        .from(sourceVersions)
        .where(
          and(
            eq(sourceVersions.id, versionId),
            eq(sourceVersions.status, "procesando"),
          ),
        )
        .limit(1)
        .for("update");
      if (!version) return false;

      // Replacing the rows keeps a repeated completion idempotent.
      await transaction
        .delete(sourceSegments)
        .where(eq(sourceSegments.versionId, versionId));
      for (let start = 0; start < sections.length; start += segmentBatchSize) {
        await transaction.insert(sourceSegments).values(
          sections.slice(start, start + segmentBatchSize).map((section) => ({
            versionId,
            ordinal: section.ordinal,
            headingPath: section.headingPath,
            startLine: section.startLine,
            endLine: section.endLine,
            pageNumber: section.pageNumber,
            content: section.content,
          })),
        );
      }

      await transaction
        .update(sourceVersions)
        .set({
          status: "lista",
          errorCode: null,
          sectionCount: sections.length,
          pageCount,
          processedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(sourceVersions.id, versionId));
      // The candidate becomes current atomically; the previous current
      // version is kept as "reemplazada" until E2.4 defines retention.
      if (source.currentVersionId && source.currentVersionId !== versionId) {
        await transaction
          .update(sourceVersions)
          .set({ status: "reemplazada", updatedAt: sql`now()` })
          .where(eq(sourceVersions.id, source.currentVersionId));
      }
      await transaction
        .update(sources)
        .set({ currentVersionId: versionId, updatedAt: sql`now()` })
        .where(eq(sources.id, version.sourceId));
      return true;
    });
  }

  async failProcessing(
    versionId: string,
    errorCode: ProcessingErrorCode,
  ): Promise<boolean> {
    const updated = await this.database
      .update(sourceVersions)
      .set({ status: "fallida", errorCode, updatedAt: sql`now()` })
      .where(
        and(
          eq(sourceVersions.id, versionId),
          inArray(sourceVersions.status, ["en_cola", "procesando"]),
        ),
      )
      .returning({ id: sourceVersions.id });
    return updated.length === 1;
  }

  async failStaleProcessing(startedBefore: Date): Promise<number> {
    const updated = await this.database
      .update(sourceVersions)
      .set({
        status: "fallida",
        errorCode: "tiempo_agotado",
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(sourceVersions.status, "procesando"),
          lt(sourceVersions.updatedAt, startedBefore),
        ),
      )
      .returning({ id: sourceVersions.id });
    return updated.length;
  }
}
