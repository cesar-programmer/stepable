import { sql, type SQL } from "drizzle-orm";

import type {
  EmbeddingVector,
  FragmentCandidate,
  KnowledgeRepository,
} from "../../modules/knowledge/contract.ts";

import type { StepableDatabase } from "./database.ts";

type FragmentRow = {
  version_id: string;
  ordinal: number;
  source_id: string;
  title: string;
  number: number;
  format: FragmentCandidate["format"];
  page_number: number | null;
  heading_path: string[];
  start_line: number | null;
  end_line: number | null;
  content: string;
};

// Only segments of the current, ready version of an active source in the
// space are eligible; replaced, discarded or deleted content never is.
const eligibleSegments = sql`
  from public.sources source
  join public.source_versions version
    on version.id = source.current_version_id and version.status = 'lista'
  join public.source_segments segment on segment.version_id = version.id
`;

const fragmentColumns = sql`
  segment.version_id, segment.ordinal, source.id as source_id, source.title,
  version.number, version.format, segment.page_number, segment.heading_path,
  segment.start_line, segment.end_line, segment.content
`;

function toCandidate(row: FragmentRow): FragmentCandidate {
  return {
    versionId: row.version_id,
    ordinal: row.ordinal,
    sourceId: row.source_id,
    sourceTitle: row.title,
    versionNumber: row.number,
    format: row.format,
    pageNumber: row.page_number,
    headingPath: row.heading_path,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
  };
}

function sourceFilter(sourceIds?: string[]): SQL {
  if (!sourceIds) return sql``;
  if (sourceIds.length === 0) return sql`and false`;
  return sql`and source.id in (${sql.join(
    sourceIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

function vectorLiteral(values: number[]): string {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Vector de embedding no válido.");
  }
  return `[${values.join(",")}]`;
}

export class PostgresKnowledgeRepository implements KnowledgeRepository {
  private readonly database: StepableDatabase;
  /**
   * When set (worker side), only content of spaces in this job namespace is
   * processed, so a worker never touches data created by another environment.
   */
  private readonly jobNamespace: string | null;

  constructor(
    database: StepableDatabase,
    options: { jobNamespace?: string } = {},
  ) {
    this.database = database;
    this.jobNamespace = options.jobNamespace ?? null;
  }

  private async fragments(query: SQL): Promise<FragmentCandidate[]> {
    const rows = (await this.database.execute(
      query,
    )) as unknown as FragmentRow[];
    return rows.map(toCandidate);
  }

  // Natural-language questions: any meaningful word may match (OR), ranked
  // by cover density; Spanish stemming and stop words apply.
  searchLexical(
    spaceId: string,
    question: string,
    limit: number,
    sourceIds?: string[],
  ): Promise<FragmentCandidate[]> {
    return this.fragments(sql`
      select ${fragmentColumns}
      ${eligibleSegments}
      cross join lateral (
        select nullif(
          replace(plainto_tsquery('spanish', ${question})::text, '&', '|'),
          ''
        )::tsquery as query
      ) search
      where source.space_id = ${spaceId}
        and source.status = 'activa'
        and search.query is not null
        ${sourceFilter(sourceIds)}
        and segment.search_vector @@ search.query
      order by ts_rank_cd(segment.search_vector, search.query) desc,
        source.id, segment.ordinal
      limit ${limit}
    `);
  }

  searchSemantic(
    spaceId: string,
    embedding: EmbeddingVector,
    limit: number,
    sourceIds?: string[],
  ): Promise<FragmentCandidate[]> {
    return this.fragments(sql`
      select ${fragmentColumns}
      ${eligibleSegments}
      join public.source_segment_embeddings vector_row
        on vector_row.version_id = segment.version_id
        and vector_row.ordinal = segment.ordinal
        and vector_row.model = ${embedding.model}
        and vector_row.dimensions = ${embedding.values.length}
      where source.space_id = ${spaceId}
        and source.status = 'activa'
        ${sourceFilter(sourceIds)}
      order by vector_row.embedding operator(extensions.<=>)
        ${vectorLiteral(embedding.values)}::extensions.vector
      limit ${limit}
    `);
  }

  async listSegmentsMissingEmbeddings(
    model: string,
    limit: number,
    versionIds?: string[],
  ) {
    const versionFilter =
      versionIds && versionIds.length > 0
        ? sql`and version.id in (${sql.join(
            versionIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`
        : sql``;
    const rows = (await this.database.execute(sql`
      select segment.version_id, segment.ordinal, segment.content
      ${eligibleSegments}
      left join public.source_segment_embeddings vector_row
        on vector_row.version_id = segment.version_id
        and vector_row.ordinal = segment.ordinal
        and vector_row.model = ${model}
      where source.status = 'activa'
        and vector_row.version_id is null
        ${versionFilter}
        ${
          this.jobNamespace
            ? sql`and exists (
                select 1 from public.spaces space
                where space.id = source.space_id
                  and space.job_namespace = ${this.jobNamespace})`
            : sql``
        }
      order by version.updated_at, segment.version_id, segment.ordinal
      limit ${limit}
    `)) as unknown as {
      version_id: string;
      ordinal: number;
      content: string;
    }[];
    return rows.map((row) => ({
      versionId: row.version_id,
      ordinal: row.ordinal,
      content: row.content,
    }));
  }

  // Segments purged meanwhile are skipped instead of failing the batch.
  async saveEmbeddings(
    model: string,
    rows: { versionId: string; ordinal: number; values: number[] }[],
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const values = sql.join(
      rows.map(
        (row) =>
          sql`(${row.versionId}::uuid, ${row.ordinal}::integer, ${row.values.length}::integer, ${vectorLiteral(row.values)}::extensions.vector)`,
      ),
      sql`, `,
    );
    const inserted = (await this.database.execute(sql`
      insert into public.source_segment_embeddings
        (version_id, ordinal, model, dimensions, embedding)
      select input.version_id, input.ordinal, ${model}, input.dimensions,
        input.embedding
      from (values ${values})
        as input(version_id, ordinal, dimensions, embedding)
      join public.source_segments segment
        on segment.version_id = input.version_id
        and segment.ordinal = input.ordinal
      on conflict do nothing
      returning version_id
    `)) as unknown as unknown[];
    return inserted.length;
  }
}
