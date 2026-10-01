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
import { markdownMaxBytes } from "../../src/modules/sources/contract.ts";
import {
  listSpaceSources,
  readSourceContent,
  uploadSource,
} from "../../src/modules/sources/service.ts";
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

describe("E2.1 Markdown sources", () => {
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
      await sourceRepository.completeProcessing(version.id, sections),
    ).toBe(true);
    expect(
      await sourceRepository.completeProcessing(version.id, sections),
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
