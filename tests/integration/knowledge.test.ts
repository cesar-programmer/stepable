import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { PostgresKnowledgeRepository } from "../../src/adapters/postgres/knowledge-repository.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import type {
  ChatModel,
  TextEmbedder,
} from "../../src/modules/knowledge/contract.ts";
import {
  askAssistant,
  indexPendingEmbeddings,
} from "../../src/modules/knowledge/service.ts";
import {
  createAdminClient,
  createLocalTestIdentity,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
} from "../support/local-auth.ts";
import { seedReadySource } from "../support/seed-sources.ts";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const accessRepository = new PostgresAccessRepository(connection.database);
const knowledgeRepository = new PostgresKnowledgeRepository(
  connection.database,
);
const runKey = `e3-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
const versionIds: string[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let foreignOwner: LocalTestIdentity;
let spaceId: string;
let foreignSpaceId: string;
let apiSourceId: string;

const concepts: string[][] = [
  ["contrato", "api", "endpoint", "compatib", "version", "rompo"],
  ["icono", "svg", "imagen", "vectorial"],
  ["produccion", "despliegue", "lanzar", "publica", "clientes", "martes"],
];

/** Test-only "semantic" embedder: one dimension per hand-written concept. */
const conceptEmbedder: TextEmbedder = {
  model: "prueba:conceptos-3",
  async embed(texts) {
    return texts.map((text) => {
      const normalized = text
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase();
      return concepts.map(
        (words) =>
          0.01 + words.filter((word) => normalized.includes(word)).length,
      );
    });
  },
};

function recordingModel(reply: (user: string) => string) {
  const calls: string[] = [];
  const model: ChatModel = {
    label: "prueba",
    async complete({ user }) {
      calls.push(user);
      return { text: reply(user) };
    },
  };
  return { model, calls };
}

const citeFirst = () =>
  recordingModel(() =>
    JSON.stringify({
      estado: "respondida",
      respuesta: "Hay que publicar una versión mayor en la ruta [1].",
      citas: [1],
    }),
  );

async function seedSource(
  targetSpaceId: string,
  creator: LocalTestIdentity,
  title: string,
  sections: string[],
  options: { status?: "activa" | "eliminada"; replacedContent?: string } = {},
) {
  const seeded = await seedReadySource(connection.client, {
    spaceId: targetSpaceId,
    creatorId: creator.id,
    title,
    sections,
    ...options,
  });
  if (seeded.previousVersionId) versionIds.push(seeded.previousVersionId);
  versionIds.push(seeded.versionId);
  return seeded;
}

const ask = (
  question: string,
  options: {
    identity?: LocalTestIdentity;
    space?: string;
    chatModel?: ChatModel | null;
    embedder?: TextEmbedder | null;
  } = {},
) =>
  askAssistant(
    {
      accessRepository,
      knowledgeRepository,
      chatModel: options.chatModel ?? null,
      embedder: options.embedder ?? null,
    },
    {
      identityId: (options.identity ?? member).id,
      spaceId: options.space ?? spaceId,
      question,
    },
  );

const sourceIdsOf = (result: Awaited<ReturnType<typeof ask>>) =>
  "fragments" in result ? result.fragments.map((f) => f.sourceId) : [];

describe("E3 assistant retrieval and answers", () => {
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
        name: "E3 main",
      })
    ).space.id;
    foreignSpaceId = (
      await bootstrapSpace(accessRepository, {
        email: foreignOwner.email,
        slug: `${runKey}-foreign`,
        name: "E3 foreign",
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

    apiSourceId = (
      await seedSource(
        spaceId,
        owner,
        "Contratos de API",
        [
          "Cada cambio incompatible en un contrato publicado exige una nueva versión mayor en la ruta, por ejemplo /v2.",
        ],
        {
          replacedContent:
            "Regla obsoleta: los contratos nunca cambian de versión.",
        },
      )
    ).sourceId;
    await seedSource(spaceId, owner, "Íconos", [
      "Los íconos se toman del paquete compartido; no se copian archivos SVG sueltos al repositorio.",
    ]);
    await seedSource(spaceId, owner, "Despliegues", [
      "Solo se publica en producción los martes y jueves, con la revisión aprobada por dos personas.",
    ]);
    await seedSource(
      spaceId,
      owner,
      "Fuente eliminada",
      ["Contrato secreto eliminado que nunca debe aparecer."],
      { status: "eliminada" },
    );
    await seedSource(foreignSpaceId, foreignOwner, "Contratos ajenos", [
      "Contrato de API del otro espacio: usar siempre /beta.",
    ]);
  }, 60_000);

  afterAll(async () => {
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
  });

  it("retrieves direct questions lexically, only from current versions of this space", async () => {
    const result = await ask(
      "¿Cómo versiono un contrato de API con un cambio incompatible?",
    );
    expect(result.kind).toBe("retrieval_only");
    if (!("fragments" in result)) throw new Error("sin fragmentos");
    expect(result.fragments[0].sourceId).toBe(apiSourceId);
    const contents = result.fragments.map((fragment) => fragment.content);
    expect(contents.join(" ")).not.toMatch(/obsoleta|secreto|\/beta/);

    // Lexical search alone misses the paraphrase.
    const paraphrase = await ask(
      "Si rompo la compatibilidad de un endpoint, ¿qué número tengo que subir?",
    );
    expect(sourceIdsOf(paraphrase)).not.toContain(apiSourceId);
  });

  it("finds paraphrases through embeddings indexed per segment and model", async () => {
    const saved = await indexPendingEmbeddings(
      { knowledgeRepository, embedder: conceptEmbedder },
      { maxSegments: 50, versionIds },
    );
    expect(saved).toBe(4);
    await expect(
      indexPendingEmbeddings(
        { knowledgeRepository, embedder: conceptEmbedder },
        { maxSegments: 50, versionIds },
      ),
    ).resolves.toBe(0);

    const result = await ask(
      "Si rompo la compatibilidad de un endpoint, ¿qué número tengo que subir?",
      { embedder: conceptEmbedder },
    );
    if (!("fragments" in result)) throw new Error("sin fragmentos");
    expect(result.retrieval.semantic).toBeGreaterThan(0);
    expect(result.fragments[0].sourceId).toBe(apiSourceId);
    expect(
      result.fragments.map((fragment) => fragment.content).join(" "),
    ).not.toMatch(/obsoleta|secreto|\/beta/);
  });

  it("builds citations from retrieved fragments and rejects invented ones", async () => {
    const good = citeFirst();
    const answered = await ask(
      "¿Cómo versiono un contrato de API con un cambio incompatible?",
      { chatModel: good.model },
    );
    expect(answered).toMatchObject({
      kind: "answered",
      citations: [
        {
          ref: 1,
          sourceId: apiSourceId,
          sourceTitle: "Contratos de API",
          versionNumber: 2,
        },
      ],
    });
    expect(good.calls[0]).toContain('<fragmento id="1"');

    const invented = recordingModel(() =>
      JSON.stringify({
        estado: "respondida",
        respuesta: "Hay que usar /v3 [7].",
        citas: [7],
      }),
    );
    await expect(
      ask("¿Cómo versiono un contrato de API?", { chatModel: invented.model }),
    ).resolves.toMatchObject({ kind: "unverifiable" });
  });

  it("acknowledges missing evidence without inventing a procedure", async () => {
    const lexicalOnly = citeFirst();
    await expect(
      ask("¿Cuál es la política de vacaciones?", {
        chatModel: lexicalOnly.model,
      }),
    ).resolves.toMatchObject({ kind: "insufficient", fragments: [] });
    expect(lexicalOnly.calls).toHaveLength(0);

    const declines = recordingModel(() =>
      JSON.stringify({ estado: "insuficiente", respuesta: "", citas: [] }),
    );
    await expect(
      ask("¿Cuál es la política de vacaciones?", {
        chatModel: declines.model,
        embedder: conceptEmbedder,
      }),
    ).resolves.toMatchObject({ kind: "insufficient" });
  });

  it("refuses other spaces before retrieving or calling the model", async () => {
    const model = citeFirst();
    await expect(
      ask("¿Cómo versiono un contrato de API?", {
        identity: foreignOwner,
        chatModel: model.model,
      }),
    ).resolves.toEqual({ kind: "unauthorized" });
    expect(model.calls).toHaveLength(0);

    const ownSpace = await ask("¿Cómo versiono un contrato de API?", {
      identity: foreignOwner,
      space: foreignSpaceId,
      embedder: conceptEmbedder,
    });
    expect(sourceIdsOf(ownSpace)).not.toContain(apiSourceId);
  });

  it("removes embeddings together with purged segments", async () => {
    const [current] = await connection.client<{ id: string }[]>`
      select current_version_id as id from public.sources where id = ${apiSourceId}
    `;
    await connection.client`
      delete from public.source_segments where version_id = ${current.id}
    `;
    const [row] = await connection.client`
      select count(*)::int as count from public.source_segment_embeddings
      where version_id = ${current.id}
    `;
    expect(row.count).toBe(0);
  });
});
