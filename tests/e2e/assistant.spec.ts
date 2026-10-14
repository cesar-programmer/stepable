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
let foreignSpaceId: string;
let sourceId: string;

async function login(page: Page, identity: LocalTestIdentity) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contraseña").fill(identity.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/spaces$/);
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
    foreignSpaceId = (
      await bootstrapSpace(repository, {
        email: foreign.email,
        slug: `${runKey}-foreign`,
        name: "Foreign assistant space",
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
    // A second space for the member, to check that sessions do not cross.
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${foreignSpaceId}, ${member.id}, 'integrante')
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
    await page
      .getByRole("navigation", { name: "Espacio" })
      .getByRole("link", { name: "Asistente", exact: true })
      .click();
    // Guard: never send questions to a server configured with a real model.
    await expect(page.getByTestId("assistant-mode")).toContainText(
      "Conversación: simulado",
    );

    // An example only fills the field; nothing is sent.
    const field = page.getByLabel("Pregunta");
    await page
      .getByRole("button", { name: "¿Qué pasos sigue una revisión de código?" })
      .click();
    await expect(field).toHaveValue("¿Qué pasos sigue una revisión de código?");
    await expect(field).toBeFocused();
    await expect(page.getByRole("region", { name: "Respuesta" })).toHaveCount(
      0,
    );

    await field.fill("¿Cómo versiono un contrato con un cambio incompatible?");
    await page.getByRole("button", { name: "Preguntar" }).click();
    const answer = page.getByRole("region", { name: "Respuesta" });
    await expect(answer).toContainText("Respuesta simulada");
    await expect(answer).toContainText(
      "Versión 1 · Contratos de API · líneas 1–2",
    );
    await expect(answer.getByRole("link", { name: "Cita 1" })).toBeVisible();
    // The answer clears the field; editing brings the question back unsent.
    await expect(field).toHaveValue("");
    await page.getByRole("button", { name: "Editar esta pregunta" }).click();
    await expect(field).toHaveValue(
      "¿Cómo versiono un contrato con un cambio incompatible?",
    );
    await expect(answer).toBeVisible();

    await page
      .getByLabel("Pregunta")
      .fill("¿Cuál es la política de vacaciones?");
    await page.getByRole("button", { name: "Preguntar" }).click();
    await expect(
      page.getByText("No encontré información suficiente"),
    ).toBeVisible();
    // A failed query keeps what was written.
    await expect(page.getByLabel("Pregunta")).toHaveValue(
      "¿Cuál es la política de vacaciones?",
    );

    await page
      .getByLabel("Pregunta")
      .fill("¿Cómo versiono un contrato con un cambio incompatible?");
    await page.getByRole("button", { name: "Preguntar" }).click();
    await page
      .getByRole("region", { name: "Respuesta" })
      .getByRole("link", { name: "Contratos de API" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/sources/${sourceId}$`));
  });

  test("the floating assistant keeps its session only inside the space", async ({
    page,
  }) => {
    await login(page, member);
    const fab = page.locator(".assistant-fab");
    // Not outside a space.
    await expect(fab).toHaveCount(0);

    await page.goto(`/spaces/${spaceId}`);
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });

    // Opening and closing sends nothing; Escape closes and focus returns.
    await fab.click();
    const panel = page.getByRole("dialog", { name: "Preguntar al asistente" });
    const field = panel.getByLabel("Pregunta");
    await expect(field).toBeFocused();
    await field.fill("¿Cómo versiono un contrato con un cambio incompatible?");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(fab).toBeFocused();
    expect(posts).toHaveLength(0);

    // The text survives navigating inside the space.
    const nav = page.getByRole("navigation", { name: "Espacio" });
    await nav.getByRole("link", { name: "Rutas", exact: true }).click();
    await expect(page).toHaveURL(/\/routes$/);
    await fab.click();
    await expect(field).toHaveValue(
      "¿Cómo versiono un contrato con un cambio incompatible?",
    );
    expect(posts).toHaveLength(0);

    // So does the last result, after closing the panel.
    await panel.getByRole("button", { name: "Preguntar" }).click();
    const answer = panel.getByRole("region", { name: "Respuesta" });
    await expect(answer).toContainText("Respuesta simulada");
    expect(posts).toHaveLength(1);
    await panel.getByRole("button", { name: "Cerrar asistente" }).click();
    await nav.getByRole("link", { name: "Fuentes", exact: true }).click();
    await expect(page).toHaveURL(/\/sources$/);
    await fab.click();
    await expect(answer).toContainText("Respuesta simulada");

    // The Asistente page shows the same session, without the button.
    await panel
      .getByRole("link", { name: "Abrir en la página Asistente" })
      .click();
    await expect(page).toHaveURL(/\/assistant$/);
    await expect(fab).toHaveCount(0);
    await expect(
      page.getByRole("main").getByRole("region", { name: "Respuesta" }),
    ).toContainText("Respuesta simulada");

    // Another space starts empty (a client-side change, no reload).
    await page.getByText("Espacio actual").click();
    await page.getByRole("link", { name: "Foreign assistant space" }).click();
    await expect(page).toHaveURL(new RegExp(`/spaces/${foreignSpaceId}$`));
    await fab.click();
    await expect(field).toHaveValue("");
    await expect(answer).toHaveCount(0);
    expect(posts).toHaveLength(1);
  });

  test("only responsibles see the space's estimated AI consumption", async ({
    page,
    browser,
  }) => {
    await login(page, owner);
    await page.goto(`/spaces/${spaceId}`);
    const summary = page.getByTestId("ai-usage");
    await expect(summary).toContainText("Consumo de IA registrado desde");
    await expect(summary).toContainText(
      "no es la factura ni el saldo de OpenAI",
    );
    await expect(summary).toContainText("de 0,2000 USD");

    const context = await browser.newContext();
    const memberPage = await context.newPage();
    await login(memberPage, member);
    await memberPage.goto(`/spaces/${spaceId}`);
    await expect(memberPage.getByTestId("ai-usage")).toHaveCount(0);
    await context.close();
  });

  test("a user from another space cannot open the assistant", async ({
    page,
  }) => {
    await login(page, foreign);
    expect((await page.goto(`/spaces/${spaceId}/assistant`))?.status()).toBe(
      404,
    );

    // In their own space, without ready sources, nothing can be asked yet.
    await page.goto(`/spaces/${foreignSpaceId}/assistant`);
    await expect(
      page.getByRole("heading", { name: "Todavía no hay fuentes listas" }),
    ).toBeVisible();
    await expect(page.getByLabel("Pregunta")).toHaveCount(0);
  });
});
