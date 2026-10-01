import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createSourceBoss,
  PgBossSourceQueue,
  startSourceBoss,
} from "../../src/adapters/pg-boss/source-queue.ts";
import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresSourceRepository } from "../../src/adapters/postgres/source-repository.ts";
import {
  sourceBucket,
  SupabaseSourceStorage,
} from "../../src/adapters/supabase/source-storage.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import {
  markdownMaxBytes,
  pdfMaxBytes,
} from "../../src/modules/sources/contract.ts";
import {
  deleteSource,
  listSpaceSources,
  readSourceContent,
  replaceSourceFile,
  retrySourceProcessing,
  uploadSource,
} from "../../src/modules/sources/service.ts";
import type { SourceSummary } from "../../src/modules/sources/contract.ts";
import {
  startSourceWorker,
  type SourceWorker,
} from "../../src/worker/source-worker.ts";
import {
  createAdminClient,
  createLocalTestIdentity,
  createPublicClient,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
} from "../support/local-auth.ts";
import { syntheticPdf } from "../support/synthetic-pdf.ts";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const boss = createSourceBoss(config.databaseUrl, "web");
const accessRepository = new PostgresAccessRepository(connection.database);
const sourceRepository = new PostgresSourceRepository(
  connection.database,
  new PgBossSourceQueue(boss),
);
const storage = new SupabaseSourceStorage(config.apiUrl, config.serviceRoleKey);
const dependencies = { accessRepository, sourceRepository, storage };
const runKey = `e2-1-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let foreignOwner: LocalTestIdentity;
let spaceId: string;
let otherOwnedSpaceId: string;
let foreignSpaceId: string;
let worker: SourceWorker | null = null;

const encode = (text: string) => new TextEncoder().encode(text);

async function upload(
  fileName: string,
  bytes: Uint8Array,
  identity = owner,
  targetSpaceId = spaceId,
) {
  return uploadSource(dependencies, {
    identityId: identity.id,
    spaceId: targetSpaceId,
    fileName,
    bytes,
  });
}

async function queuedSourceId(fileName: string, text: string) {
  const result = await upload(fileName, encode(text));
  if (result.kind !== "queued")
    throw new Error(`Carga rechazada: ${result.kind}`);
  return result.sourceId;
}

async function waitForSource(
  sourceId: string,
  done: (source: SourceSummary) => boolean,
) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const source = await sourceRepository.findSource(spaceId, sourceId, false);
    if (source && done(source)) return source;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("La fuente no alcanzó el estado esperado a tiempo.");
}

const replace = (
  sourceId: string,
  fileName: string,
  bytes: Uint8Array,
  identity = owner,
) =>
  replaceSourceFile(dependencies, {
    identityId: identity.id,
    spaceId,
    sourceId,
    fileName,
    bytes,
  });

const retry = (sourceId: string, identity = owner) =>
  retrySourceProcessing(dependencies, {
    identityId: identity.id,
    spaceId,
    sourceId,
  });

async function memberText(sourceId: string) {
  const content = await readSourceContent(dependencies, {
    identityId: member.id,
    spaceId,
    sourceId,
  });
  return content?.sections.map((section) => section.content).join("\n");
}

async function jobCount(sourceId: string, versionNumber: number) {
  const [row] = await connection.client`
    select count(*)::int as count from pgboss.job
    where name = 'procesar-fuente' and data->>'versionId' = (
      select id::text from public.source_versions
      where source_id = ${sourceId} and number = ${versionNumber}
    )
  `;
  return row.count as number;
}

async function waitForTerminalStatus(sourceId: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const source = await sourceRepository.findSource(spaceId, sourceId, false);
    if (source && (source.status === "lista" || source.status === "fallida")) {
      return source;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("La fuente no terminó de procesarse a tiempo.");
}

async function startWorker() {
  worker = await startSourceWorker({
    databaseUrl: config.databaseUrl,
    supabaseUrl: config.apiUrl,
    serviceRoleKey: config.serviceRoleKey,
    pollingIntervalSeconds: 0.5,
  });
}

async function storedObjects(targetSpaceId: string): Promise<string[]> {
  const rows = await connection.client<{ name: string }[]>`
    select name from storage.objects
    where bucket_id = ${sourceBucket} and name like ${`${targetSpaceId}/%`}
  `;
  return rows.map((row) => row.name);
}

describe("E2 Markdown and PDF sources", () => {
  beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );
    [owner, member, foreignOwner] = identities;
    spaceId = (
      await bootstrapSpace(accessRepository, {
        email: owner.email,
        slug: `${runKey}-main`,
        name: "E2.1 sources",
      })
    ).space.id;
    otherOwnedSpaceId = (
      await bootstrapSpace(accessRepository, {
        email: owner.email,
        slug: `${runKey}-other`,
        name: "E2.1 other",
      })
    ).space.id;
    foreignSpaceId = (
      await bootstrapSpace(accessRepository, {
        email: foreignOwner.email,
        slug: `${runKey}-foreign`,
        name: "E2.1 foreign",
      })
    ).space.id;
    await connection.client`
      insert into public.profiles (identity_id) values (${member.id})
      on conflict (identity_id) do nothing
    `;
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${spaceId}, ${member.id}, 'integrante')
    `;
    await startSourceBoss(boss);
  }, 30_000);

  afterAll(async () => {
    await worker?.stop();
    await boss.stop({ graceful: false });
    for (const id of [spaceId, otherOwnedSpaceId, foreignSpaceId]) {
      const names = id ? await storedObjects(id) : [];
      if (names.length > 0) {
        await admin.storage.from(sourceBucket).remove(names);
      }
    }
    await connection.client`
      delete from public.spaces where slug like ${`${runKey}%`}
    `;
    for (const identity of identities) {
      await connection.client`
        delete from public.profiles where identity_id = ${identity.id}
      `;
      await deleteLocalTestIdentity(admin, identity.id);
    }
    await connection.close();
  }, 30_000);

  it("keeps an upload queued until a worker processes it into sections", async () => {
    const sourceId = await queuedSourceId(
      "guia.md",
      "# Guía de APIs\nUsar contratos versionados.\n## Errores\nCódigos estables.",
    );

    const queued = await sourceRepository.findSource(spaceId, sourceId, false);
    expect(queued).toMatchObject({ status: "en_cola", versionNumber: 1 });
    const [job] = await connection.client`
      select count(*)::int as count from pgboss.job
      where name = 'procesar-fuente'
        and data->>'versionId' = (
          select id::text from public.source_versions where source_id = ${sourceId}
        )
    `;
    expect(job.count).toBe(1);
    expect(await storedObjects(spaceId)).toHaveLength(1);

    await startWorker();
    const ready = await waitForTerminalStatus(sourceId);
    expect(ready).toMatchObject({ status: "lista", sectionCount: 2 });

    const content = await readSourceContent(dependencies, {
      identityId: member.id,
      spaceId,
      sourceId,
    });
    expect(content?.sections.map((section) => section.headingPath)).toEqual([
      ["Guía de APIs"],
      ["Guía de APIs", "Errores"],
    ]);
  }, 30_000);

  it("accepts short useful content and shows invalid content as failed", async () => {
    const shortId = await queuedSourceId("corto.md", "Hola");
    const emptyId = await queuedSourceId("vacio.md", " \n\n\t");
    const binary = await upload(
      "binario.md",
      new Uint8Array([0xff, 0xfe, 0x00]),
    );
    if (binary.kind !== "queued") throw new Error("Carga binaria rechazada");

    expect(await waitForTerminalStatus(shortId)).toMatchObject({
      status: "lista",
      sectionCount: 1,
    });
    expect(await waitForTerminalStatus(emptyId)).toMatchObject({
      status: "fallida",
      errorCode: "contenido_vacio",
    });
    expect(await waitForTerminalStatus(binary.sourceId)).toMatchObject({
      status: "fallida",
      errorCode: "codificacion_invalida",
    });
    expect(
      await sourceRepository.listCurrentSections(spaceId, binary.sourceId),
    ).toEqual([]);

    const ownerView = await listSpaceSources(dependencies, {
      identityId: owner.id,
      spaceId,
    });
    const memberView = await listSpaceSources(dependencies, {
      identityId: member.id,
      spaceId,
    });
    expect(ownerView?.canManage).toBe(true);
    expect(ownerView?.sources.map((source) => source.id)).toContain(emptyId);
    expect(memberView?.canManage).toBe(false);
    expect(
      memberView?.sources.every((source) => source.status === "lista"),
    ).toBe(true);
    expect(memberView?.sources.map((source) => source.id)).not.toContain(
      emptyId,
    );
    expect(
      await readSourceContent(dependencies, {
        identityId: member.id,
        spaceId,
        sourceId: emptyId,
      }),
    ).toBeNull();
  }, 30_000);

  it("rejects unsupported, empty and oversized files before storing anything", async () => {
    const before = await storedObjects(spaceId);
    await expect(upload("notas.txt", encode("texto"))).resolves.toEqual({
      kind: "rejected",
      code: "formato_no_admitido",
    });
    await expect(upload("vacio.md", new Uint8Array())).resolves.toEqual({
      kind: "rejected",
      code: "archivo_vacio",
    });
    await expect(
      upload("grande.md", new Uint8Array(markdownMaxBytes + 1).fill(0x61)),
    ).resolves.toEqual({ kind: "rejected", code: "archivo_demasiado_grande" });
    expect(await storedObjects(spaceId)).toEqual(before);
  });

  it("processes PDFs with text per page and rejects invalid PDFs visibly", async () => {
    const guide = await upload(
      "manual.pdf",
      syntheticPdf([
        "Contratos de API\nVersionar siempre",
        null,
        "Íconos: set único",
      ]),
    );
    const short = await upload("corto.pdf", syntheticPdf(["Hola"]));
    const scanned = await upload("escaneado.pdf", syntheticPdf([null, null]));
    const encrypted = await upload(
      "cifrado.pdf",
      syntheticPdf([null], { userPassword: "secreto" }),
    );
    if (
      guide.kind !== "queued" ||
      short.kind !== "queued" ||
      scanned.kind !== "queued" ||
      encrypted.kind !== "queued"
    ) {
      throw new Error("Carga PDF rechazada");
    }

    expect(await waitForTerminalStatus(guide.sourceId)).toMatchObject({
      format: "pdf",
      status: "lista",
      pageCount: 3,
      sectionCount: 2,
    });
    const content = await readSourceContent(dependencies, {
      identityId: member.id,
      spaceId,
      sourceId: guide.sourceId,
    });
    expect(
      content?.sections.map(({ pageNumber, content: text }) => ({
        pageNumber,
        text,
      })),
    ).toEqual([
      { pageNumber: 1, text: "Contratos de API\nVersionar siempre" },
      { pageNumber: 3, text: "Íconos: set único" },
    ]);
    expect(await waitForTerminalStatus(short.sourceId)).toMatchObject({
      status: "lista",
      sectionCount: 1,
    });
    expect(await waitForTerminalStatus(scanned.sourceId)).toMatchObject({
      status: "fallida",
      errorCode: "sin_texto_extraible",
    });
    expect(await waitForTerminalStatus(encrypted.sourceId)).toMatchObject({
      status: "fallida",
      errorCode: "pdf_protegido",
    });

    const before = await storedObjects(spaceId);
    await expect(upload("falso.pdf", encode("no soy un PDF"))).resolves.toEqual(
      {
        kind: "rejected",
        code: "formato_no_admitido",
      },
    );
    const oversized = new Uint8Array(pdfMaxBytes + 1);
    oversized.set(encode("%PDF-1.4\n"));
    await expect(upload("grande.pdf", oversized)).resolves.toEqual({
      kind: "rejected",
      code: "archivo_demasiado_grande",
    });
    expect(await storedObjects(spaceId)).toEqual(before);
  }, 60_000);

  it("replaces a source atomically, keeps the current version on failure and limits retries", async () => {
    const sourceId = await queuedSourceId(
      "politica.md",
      "# Política\nVersión uno",
    );
    await waitForTerminalStatus(sourceId);

    // Without a worker the candidate stays pending and v1 remains readable.
    await worker?.stop();
    worker = null;
    await expect(
      replace(sourceId, "politica.pdf", syntheticPdf(["Versión dos en PDF"])),
    ).resolves.toEqual({ kind: "queued", versionNumber: 2 });
    expect(
      await sourceRepository.findSource(spaceId, sourceId, false),
    ).toMatchObject({
      versionNumber: 1,
      status: "lista",
      pending: { versionNumber: 2, status: "en_cola", format: "pdf" },
    });
    expect(
      await sourceRepository.findSource(spaceId, sourceId, true),
    ).toMatchObject({ versionNumber: 1, pending: null });
    expect(await memberText(sourceId)).toBe("# Política\nVersión uno");
    await expect(
      replace(sourceId, "otra.md", encode("# Otra")),
    ).resolves.toEqual({ kind: "rejected", code: "reemplazo_en_curso" });
    await expect(retry(sourceId)).resolves.toEqual({ kind: "already_queued" });
    expect(await jobCount(sourceId, 2)).toBe(1);
    await expect(
      replace(sourceId, "intento.md", encode("# x"), member),
    ).resolves.toEqual({ kind: "unauthorized" });
    await expect(
      replace(sourceId, "intento.md", encode("# x"), foreignOwner),
    ).resolves.toEqual({ kind: "unauthorized" });
    await expect(retry(sourceId, member)).resolves.toEqual({
      kind: "unauthorized",
    });

    await startWorker();
    await waitForSource(sourceId, (source) => source.pending === null);
    expect(await memberText(sourceId)).toBe("Versión dos en PDF");
    const versions = await connection.client`
      select number, status from public.source_versions
      where source_id = ${sourceId} order by number
    `;
    expect(versions).toEqual([
      { number: 1, status: "reemplazada" },
      { number: 2, status: "lista" },
    ]);
    await expect(
      replace(sourceId, "igual.pdf", syntheticPdf(["Versión dos en PDF"])),
    ).resolves.toEqual({ kind: "rejected", code: "sin_cambios" });

    // A failed candidate never touches the current version.
    await replace(sourceId, "roto.md", new Uint8Array([0xff, 0xfe, 0x00]));
    await waitForSource(
      sourceId,
      (source) => source.pending?.status === "fallida",
    );
    expect(
      await sourceRepository.findSource(spaceId, sourceId, false),
    ).toMatchObject({
      versionNumber: 2,
      status: "lista",
      pending: { versionNumber: 3, errorCode: "codificacion_invalida" },
    });
    expect(await memberText(sourceId)).toBe("Versión dos en PDF");

    // A double click queues a single retry; at most three manual retries.
    const doubleClick = await Promise.all([retry(sourceId), retry(sourceId)]);
    expect(doubleClick.map((result) => result.kind).sort()).toEqual([
      "already_queued",
      "queued",
    ]);
    expect(await jobCount(sourceId, 3)).toBe(2);
    for (let manualRetry = 1; manualRetry <= 3; manualRetry += 1) {
      if (manualRetry > 1) {
        await expect(retry(sourceId)).resolves.toMatchObject({
          kind: "queued",
        });
      }
      await waitForSource(
        sourceId,
        (source) =>
          source.pending?.status === "fallida" &&
          source.pending.manualRetries === manualRetry,
      );
    }
    await expect(retry(sourceId)).resolves.toEqual({
      kind: "limite_de_reintentos",
    });

    // A corrected file supersedes the failed candidate.
    await expect(
      replace(sourceId, "corregido.md", encode("# Política\nVersión cuatro")),
    ).resolves.toEqual({ kind: "queued", versionNumber: 4 });
    await waitForSource(
      sourceId,
      (source) => source.pending === null && source.versionNumber === 4,
    );
    expect(await memberText(sourceId)).toBe("# Política\nVersión cuatro");
    const finalVersions = await connection.client`
      select number, status from public.source_versions
      where source_id = ${sourceId} order by number
    `;
    expect(finalVersions.map((version) => version.status)).toEqual([
      "reemplazada",
      "reemplazada",
      "descartada",
      "lista",
    ]);

    // A failed first version can also be corrected by uploading a new file.
    const failedFirst = await upload("primero.md", encode("   "));
    if (failedFirst.kind !== "queued") throw new Error("Carga rechazada");
    await waitForTerminalStatus(failedFirst.sourceId);
    await replace(failedFirst.sourceId, "primero.md", encode("Ahora sí"));
    expect(
      await waitForSource(
        failedFirst.sourceId,
        (source) => source.status === "lista",
      ),
    ).toMatchObject({ versionNumber: 2, pending: null });
  }, 120_000);

  it("deletes a source with all its versions, hides it at once and purges its content", async () => {
    const remove = (sourceId: string, identity = owner) =>
      deleteSource(dependencies, {
        identityId: identity.id,
        spaceId,
        sourceId,
      });
    const objectsOf = async (sourceId: string) =>
      (await storedObjects(spaceId)).filter((name) =>
        name.startsWith(`${spaceId}/${sourceId}/`),
      );
    const segmentsOf = async (sourceId: string) => {
      const [row] = await connection.client`
        select count(*)::int as count from public.source_segments segment
        join public.source_versions version on version.id = segment.version_id
        where version.source_id = ${sourceId}
      `;
      return row.count as number;
    };
    const waitForPurge = async (sourceId: string) => {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const [row] = await connection.client`
          select purged_at from public.sources where id = ${sourceId}
        `;
        if (row?.purged_at) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error("La purga no terminó a tiempo.");
    };

    // Three versions: replaced Markdown, current PDF and a failed candidate.
    const sourceId = await queuedSourceId("desechable.md", "# Uno\nPrimera");
    await waitForTerminalStatus(sourceId);
    await replace(sourceId, "desechable.pdf", syntheticPdf(["Segunda"]));
    await waitForSource(sourceId, (source) => source.versionNumber === 2);
    await replace(sourceId, "rota.md", new Uint8Array([0xff, 0xfe, 0x00]));
    await waitForSource(
      sourceId,
      (source) => source.pending?.status === "fallida",
    );
    expect(await objectsOf(sourceId)).toHaveLength(3);
    expect(await segmentsOf(sourceId)).toBe(2);

    await expect(remove(sourceId, member)).resolves.toEqual({
      kind: "unauthorized",
    });
    await expect(remove(sourceId, foreignOwner)).resolves.toEqual({
      kind: "unauthorized",
    });
    await expect(remove(sourceId)).resolves.toEqual({ kind: "deleted" });
    await expect(remove(sourceId)).resolves.toEqual({ kind: "not_found" });

    for (const onlyReady of [true, false]) {
      expect(
        await sourceRepository.findSource(spaceId, sourceId, onlyReady),
      ).toBeNull();
    }
    for (const identity of [owner, member]) {
      expect(
        (
          await listSpaceSources(dependencies, {
            identityId: identity.id,
            spaceId,
          })
        )?.sources.some((source) => source.id === sourceId),
      ).toBe(false);
      expect(
        await readSourceContent(dependencies, {
          identityId: identity.id,
          spaceId,
          sourceId,
        }),
      ).toBeNull();
    }
    await expect(retry(sourceId)).resolves.toEqual({ kind: "not_found" });
    await expect(
      replace(sourceId, "otra.md", encode("# Otra")),
    ).resolves.toEqual({ kind: "not_found" });

    await waitForPurge(sourceId);
    expect(await objectsOf(sourceId)).toEqual([]);
    expect(await segmentsOf(sourceId)).toBe(0);
    const [metadata] = await connection.client`
      select title, status, deleted_by,
        (select count(*)::int from public.source_versions
         where source_id = ${sourceId}) as versions,
        (select count(*)::int from public.source_versions
         where source_id = ${sourceId} and sha256 is not null) as fingerprints
      from public.sources where id = ${sourceId}
    `;
    expect(metadata).toEqual({
      title: null,
      status: "eliminada",
      deleted_by: owner.id,
      versions: 3,
      fingerprints: 0,
    });
    const events = await connection.client`
      select action from public.access_audit_events
      where target_type = 'fuente' and target_id = ${sourceId}
      order by occurred_at
    `;
    expect(events.map((event) => event.action)).toEqual([
      "fuente_cargada",
      "fuente_reemplazada",
      "fuente_reemplazada",
      "fuente_eliminada",
    ]);
  }, 120_000);

  it("never republishes a deleted source from a pending or running job", async () => {
    // Pending: the job is queued while no worker runs.
    await worker?.stop();
    worker = null;
    const pendingId = await queuedSourceId("pendiente.md", "# Pendiente");
    await expect(
      deleteSource(dependencies, {
        identityId: owner.id,
        spaceId,
        sourceId: pendingId,
      }),
    ).resolves.toEqual({ kind: "deleted" });

    // Running: processing started before the deletion committed.
    const runningId = await queuedSourceId("en-curso.md", "# En curso");
    const [version] = await connection.client<{ id: string }[]>`
      select id from public.source_versions where source_id = ${runningId}
    `;
    const started = await sourceRepository.startProcessing(version.id);
    expect(started).not.toBeNull();
    await deleteSource(dependencies, {
      identityId: owner.id,
      spaceId,
      sourceId: runningId,
    });
    expect(
      await sourceRepository.completeProcessing(
        version.id,
        [
          {
            ordinal: 0,
            headingPath: ["En curso"],
            startLine: 1,
            endLine: 1,
            pageNumber: null,
            content: "# En curso",
          },
        ],
        null,
      ),
    ).toBe(false);

    await startWorker();
    for (const sourceId of [pendingId, runningId]) {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const [row] = await connection.client`
          select purged_at from public.sources where id = ${sourceId}
        `;
        if (row.purged_at) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const [row] = await connection.client`
        select status, current_version_id, purged_at,
          (select count(*)::int from public.source_segments segment
           join public.source_versions version on version.id = segment.version_id
           where version.source_id = ${sourceId}) as segments
        from public.sources where id = ${sourceId}
      `;
      expect(row).toMatchObject({
        status: "eliminada",
        current_version_id: null,
        segments: 0,
      });
      expect(row.purged_at).not.toBeNull();
    }
  }, 120_000);

  it("isolates sources by space and role, including crossed identifiers", async () => {
    const sourceId = await queuedSourceId("aislada.md", "# Privada\nSolo A.");
    await waitForTerminalStatus(sourceId);

    await expect(upload("intento.md", encode("x"), member)).resolves.toEqual({
      kind: "unauthorized",
    });
    await expect(
      upload("intento.md", encode("x"), foreignOwner),
    ).resolves.toEqual({ kind: "unauthorized" });
    expect(
      await listSpaceSources(dependencies, {
        identityId: foreignOwner.id,
        spaceId,
      }),
    ).toBeNull();
    for (const [identity, targetSpaceId] of [
      [foreignOwner, spaceId],
      [foreignOwner, foreignSpaceId],
      [owner, otherOwnedSpaceId],
    ] as const) {
      expect(
        await readSourceContent(dependencies, {
          identityId: identity.id,
          spaceId: targetSpaceId,
          sourceId,
        }),
      ).toBeNull();
    }

    await connection.client`
      update public.memberships set status = 'revocada'
      where space_id = ${spaceId} and profile_id = ${member.id}
    `;
    expect(
      await readSourceContent(dependencies, {
        identityId: member.id,
        spaceId,
        sourceId,
      }),
    ).toBeNull();
    await connection.client`
      update public.memberships set status = 'activa'
      where space_id = ${spaceId} and profile_id = ${member.id}
    `;
  }, 30_000);

  it("does not duplicate sections when a completion is repeated", async () => {
    const sourceId = await queuedSourceId("repetida.md", "# Uno\na\n# Dos\nb");
    await waitForTerminalStatus(sourceId);
    const [version] = await connection.client<{ id: string }[]>`
      select id from public.source_versions where source_id = ${sourceId}
    `;
    const sections = await sourceRepository.listCurrentSections(
      spaceId,
      sourceId,
    );

    await connection.client`
      update public.source_versions set status = 'procesando' where id = ${version.id}
    `;
    expect(
      await sourceRepository.completeProcessing(version.id, sections, null),
    ).toBe(true);
    expect(
      await sourceRepository.completeProcessing(version.id, sections, null),
    ).toBe(false);
    expect(
      await sourceRepository.listCurrentSections(spaceId, sourceId),
    ).toHaveLength(2);

    await connection.client`
      update public.source_versions
      set status = 'procesando', section_count = null, processed_at = null,
          updated_at = now() - interval '1 hour'
      where id = ${version.id}
    `;
    expect(
      await sourceRepository.failStaleProcessing(
        new Date(Date.now() - 30 * 60 * 1000),
      ),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await sourceRepository.findSource(spaceId, sourceId, false),
    ).toMatchObject({ status: "fallida", errorCode: "tiempo_agotado" });
  }, 30_000);

  it("keeps source tables, originals and the queue closed to browser roles", async () => {
    const tables = await connection.client`
      select c.relname as table_name, c.relrowsecurity as row_security,
        has_table_privilege('anon', c.oid, 'select,insert,update,delete') as anon_access,
        has_table_privilege('authenticated', c.oid, 'select,insert,update,delete') as authenticated_access
      from pg_class c
      inner join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('sources', 'source_versions', 'source_segments')
    `;
    expect(tables).toHaveLength(3);
    expect(
      tables.every(
        (table) =>
          table.row_security &&
          !table.anon_access &&
          !table.authenticated_access,
      ),
    ).toBe(true);

    const [queue] = await connection.client`
      select has_schema_privilege('anon', 'pgboss', 'usage') as anon_usage,
        has_schema_privilege('authenticated', 'pgboss', 'usage') as authenticated_usage
    `;
    expect(queue).toEqual({ anon_usage: false, authenticated_usage: false });

    const [objectName] = await storedObjects(spaceId);
    const anonymous = createPublicClient(config);
    expect(
      (await anonymous.storage.from(sourceBucket).download(objectName)).data,
    ).toBeNull();

    const signedIn = createPublicClient(config);
    await signedIn.auth.signInWithPassword({
      email: owner.email,
      password: owner.password,
    });
    expect(
      (await signedIn.storage.from(sourceBucket).download(objectName)).data,
    ).toBeNull();
    expect(
      (await signedIn.storage.from(sourceBucket).list(spaceId)).data ?? [],
    ).toEqual([]);
    expect((await signedIn.from("sources").select("id")).error?.code).toBe(
      "42501",
    );
  });
});
