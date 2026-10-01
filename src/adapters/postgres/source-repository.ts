import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";

import { allowsSpaceAction } from "../../modules/access/authorization.ts";
import {
  maxActiveSourcesPerSpace,
  type CreateSourceResult,
  type MarkdownSection,
  type NewSourceVersion,
  type ProcessingErrorCode,
  type SourceRepository,
  type SourceSummary,
  type VersionForProcessing,
} from "../../modules/sources/contract.ts";

import type { StepableDatabase } from "./database.ts";
import {
  memberships,
  sourceSegments,
  sourceVersions,
  sources,
} from "./schema.ts";

type Transaction = Parameters<
  Parameters<StepableDatabase["transaction"]>[0]
>[0];

export type SourceJobEnqueuer = {
  enqueueInTransaction(
    transaction: Transaction,
    versionId: string,
  ): Promise<void>;
};

const segmentBatchSize = 500;

const summaryColumns = {
  id: sources.id,
  title: sources.title,
  format: sourceVersions.format,
  versionNumber: sourceVersions.number,
  status: sourceVersions.status,
  errorCode: sourceVersions.errorCode,
  sectionCount: sourceVersions.sectionCount,
  updatedAt: sourceVersions.updatedAt,
};

// Readers see only the current ready version; managers see the latest one.
function versionJoin(onlyReady: boolean) {
  return onlyReady
    ? and(
        eq(sourceVersions.id, sources.currentVersionId),
        eq(sourceVersions.status, "lista"),
      )
    : and(
        eq(sourceVersions.sourceId, sources.id),
        sql`${sourceVersions.number} = (
          select max(latest.number) from public.source_versions latest
          where latest.source_id = ${sources.id}
        )`,
      );
}

export class PostgresSourceRepository implements SourceRepository {
  private readonly database: StepableDatabase;
  private readonly queue: SourceJobEnqueuer | null;

  constructor(database: StepableDatabase, queue: SourceJobEnqueuer | null) {
    this.database = database;
    this.queue = queue;
  }

  async createSourceWithFirstVersion(
    input: NewSourceVersion,
  ): Promise<CreateSourceResult> {
    const queue = this.queue;
    if (!queue) {
      throw new Error("La carga de fuentes requiere una cola configurada.");
    }

    return this.database.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`sources:${input.spaceId}`}, 0))`,
      );

      const [actor] = await transaction
        .select({ role: memberships.role, status: memberships.status })
        .from(memberships)
        .where(
          and(
            eq(memberships.spaceId, input.spaceId),
            eq(memberships.profileId, input.createdBy),
          ),
        )
        .limit(1);
      if (
        !actor ||
        !allowsSpaceAction(actor.status, actor.role, "gestionar_fuentes")
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

      return { kind: "created" as const };
    });
  }

  async listSources(
    spaceId: string,
    onlyReady: boolean,
  ): Promise<SourceSummary[]> {
    return this.database
      .select(summaryColumns)
      .from(sources)
      .innerJoin(sourceVersions, versionJoin(onlyReady))
      .where(and(eq(sources.spaceId, spaceId), eq(sources.status, "activa")))
      .orderBy(asc(sources.title), asc(sources.id));
  }

  async findSource(
    spaceId: string,
    sourceId: string,
    onlyReady: boolean,
  ): Promise<SourceSummary | null> {
    const [source] = await this.database
      .select(summaryColumns)
      .from(sources)
      .innerJoin(sourceVersions, versionJoin(onlyReady))
      .where(
        and(
          eq(sources.id, sourceId),
          eq(sources.spaceId, spaceId),
          eq(sources.status, "activa"),
        ),
      )
      .limit(1);
    return source ?? null;
  }

  async listCurrentSections(
    spaceId: string,
    sourceId: string,
  ): Promise<MarkdownSection[]> {
    return this.database
      .select({
        ordinal: sourceSegments.ordinal,
        headingPath: sourceSegments.headingPath,
        startLine: sourceSegments.startLine,
        endLine: sourceSegments.endLine,
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
        .where(eq(sourceVersions.id, versionId))
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
    sections: MarkdownSection[],
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [version] = await transaction
        .select({ sourceId: sourceVersions.sourceId })
        .from(sourceVersions)
        .innerJoin(sources, eq(sources.id, sourceVersions.sourceId))
        .where(
          and(
            eq(sourceVersions.id, versionId),
            eq(sourceVersions.status, "procesando"),
            eq(sources.status, "activa"),
          ),
        )
        .limit(1)
        .for("update", { of: sourceVersions });
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
          processedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(sourceVersions.id, versionId));
      // E2.1 only has first versions; replacement rules arrive in E2.3.
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
