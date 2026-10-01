import { createHash, randomUUID } from "node:crypto";

import type { Sql } from "postgres";

/**
 * Inserts a ready Markdown source directly in PostgreSQL (no storage object),
 * optionally with a replaced previous version or already deleted. Test-only.
 */
export async function seedReadySource(
  client: Sql,
  input: {
    spaceId: string;
    creatorId: string;
    title: string;
    sections: string[];
    status?: "activa" | "eliminada";
    replacedContent?: string;
  },
): Promise<{
  sourceId: string;
  versionId: string;
  previousVersionId?: string;
}> {
  const sourceId = randomUUID();
  const versionId = randomUUID();
  await client`
    insert into public.sources (id, space_id, title, created_by)
    values (${sourceId}, ${input.spaceId}, ${input.title}, ${input.creatorId})
  `;
  const insertVersion = (id: string, number: number, status: string) =>
    client`
      insert into public.source_versions
        (id, source_id, space_id, number, format, byte_size, sha256,
         storage_key, status, section_count, processed_at, created_by)
      values (${id}, ${sourceId}, ${input.spaceId}, ${number}, 'markdown', 100,
        ${createHash("sha256").update(id).digest("hex")},
        ${`${input.spaceId}/${sourceId}/${id}`}, ${status}, 1, now(),
        ${input.creatorId})
    `;
  let previousVersionId: string | undefined;
  if (input.replacedContent) {
    previousVersionId = randomUUID();
    await insertVersion(previousVersionId, 1, "reemplazada");
    await client`
      insert into public.source_segments
        (version_id, ordinal, heading_path, start_line, end_line, content)
      values (${previousVersionId}, 0, ${[input.title]}, 1, 2,
        ${input.replacedContent})
    `;
  }
  await insertVersion(versionId, input.replacedContent ? 2 : 1, "lista");
  for (const [ordinal, content] of input.sections.entries()) {
    await client`
      insert into public.source_segments
        (version_id, ordinal, heading_path, start_line, end_line, content)
      values (${versionId}, ${ordinal}, ${[input.title]}, ${ordinal * 3 + 1},
        ${ordinal * 3 + 2}, ${content})
    `;
  }
  await client`
    update public.sources set current_version_id = ${versionId}
    where id = ${sourceId}
  `;
  if (input.status === "eliminada") {
    await client`
      update public.sources
      set status = 'eliminada', deleted_at = now(), deleted_by = ${input.creatorId}
      where id = ${sourceId}
    `;
  }
  return { sourceId, versionId, previousVersionId };
}
