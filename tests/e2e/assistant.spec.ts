import { createHash, randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import {
  createAdminClient,
  createLocalTestIdentity,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
} from "../support/local-auth.ts";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const repository = new PostgresAccessRepository(connection.database);
const runKey = `e3-browser-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let foreign: LocalTestIdentity;
let spaceId: string;
let sourceId: string;

async function login(page: Page, identity: LocalTestIdentity) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contraseña").fill(identity.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/protected$/);
}

test.describe.serial("E3 assistant in the browser", () => {
  test.beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );
    [owner, member, foreign] = identities;
    spaceId = (
      await bootstrapSpace(repository, {
        email: owner.email,
        slug: `${runKey}-main`,
        name: "Assistant browser space",
      })
    ).space.id;
    await bootstrapSpace(repository, {
      email: foreign.email,
      slug: `${runKey}-foreign`,
      name: "Foreign assistant space",
    });
    await connection.client`
      insert into public.profiles (identity_id) values (${member.id})
      on conflict (identity_id) do nothing
    `;
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${spaceId}, ${member.id}, 'integrante')
    `;

    sourceId = randomUUID();
    const versionId = randomUUID();
    await connection.client`
      insert into public.sources (id, space_id, title, created_by)
      values (${sourceId}, ${spaceId}, 'Contratos de API', ${owner.id})
    `;
    await connection.client`
      insert into public.source_versions
        (id, source_id, space_id, number, format, byte_size, sha256,
         storage_key, status, section_count, processed_at, created_by)
      values (${versionId}, ${sourceId}, ${spaceId}, 1, 'markdown', 100,
        ${createHash("sha256").update(versionId).digest("hex")},
        ${`${spaceId}/${sourceId}/${versionId}`}, 'lista', 1, now(), ${owner.id})
    `;
    await connection.client`
      insert into public.source_segments
        (version_id, ordinal, heading_path, start_line, end_line, content)
      values (${versionId}, 0, ${["Contratos de API"]}, 1, 2,
        'Cada cambio incompatible en un contrato exige una nueva versión mayor en la ruta.')
    `;
    await connection.client`
      update public.sources set current_version_id = ${versionId} where id = ${sourceId}
    `;
  });

  test.afterAll(async () => {
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

  test("a member gets a cited answer or an explicit lack of evidence", async ({
    page,
  }) => {
    await login(page, member);
    await page.goto(`/spaces/${spaceId}`);
    await page.getByRole("link", { name: "Asistente" }).click();
    // Guard: never send questions to a server configured with a real model.
    await expect(page.getByTestId("assistant-mode")).toContainText(
      "Conversación: simulado",
    );

    await page
      .getByLabel("Pregunta")
      .fill("¿Cómo versiono un contrato con un cambio incompatible?");
    await page.getByRole("button", { name: "Preguntar" }).click();
    const answer = page.getByRole("region", { name: "Respuesta" });
    await expect(answer).toContainText("Respuesta simulada");
    await expect(answer).toContainText(
      "versión 1 · Contratos de API · líneas 1–2",
    );

    await page
      .getByLabel("Pregunta")
      .fill("¿Cuál es la política de vacaciones?");
    await page.getByRole("button", { name: "Preguntar" }).click();
    await expect(
      page.getByText("No encontré información suficiente"),
    ).toBeVisible();

    await page
      .getByLabel("Pregunta")
      .fill("¿Cómo versiono un contrato con un cambio incompatible?");
    await page.getByRole("button", { name: "Preguntar" }).click();
    await page.getByRole("link", { name: "Contratos de API" }).click();
    await expect(page).toHaveURL(new RegExp(`/sources/${sourceId}$`));
  });

  test("a user from another space cannot open the assistant", async ({
    page,
  }) => {
    await login(page, foreign);
    expect((await page.goto(`/spaces/${spaceId}/assistant`))?.status()).toBe(
      404,
    );
  });
});
