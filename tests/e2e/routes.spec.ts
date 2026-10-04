import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

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
import { seedReadySource } from "../support/seed-sources.ts";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const repository = new PostgresAccessRepository(connection.database);
const runKey = `e4-browser-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let foreign: LocalTestIdentity;
let spaceId: string;
let routeUrl: string;
let worker: ChildProcess;

async function login(page: Page, identity: LocalTestIdentity) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contraseña").fill(identity.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/protected$/);
}

// The worker generates with the simulated model only: never a paid call.
function startWorker(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--experimental-strip-types", "src/worker/main.ts"],
      {
        env: {
          ...process.env,
          STEPABLE_AI_CHAT_MODE: "simulado",
          STEPABLE_AI_EMBEDDINGS_MODE: "desactivado",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const timer = setTimeout(
      () => reject(new Error("El worker no arrancó a tiempo.")),
      20_000,
    );
    child.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("source_worker_started")) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`El worker terminó con código ${code}.`));
    });
  });
}

test.describe.serial("E4.1 onboarding routes in the browser", () => {
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
        name: "Routes browser space",
      })
    ).space.id;
    await bootstrapSpace(repository, {
      email: foreign.email,
      slug: `${runKey}-foreign`,
      name: "Foreign routes space",
    });
    await connection.client`
      insert into public.profiles (identity_id) values (${member.id})
      on conflict (identity_id) do nothing
    `;
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${spaceId}, ${member.id}, 'integrante')
    `;
    await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Contratos de API",
      sections: [
        "Para versionar contratos de API, un cambio incompatible exige una versión mayor en la ruta.",
      ],
    });
    worker = await startWorker();
  });

  test.afterAll(async () => {
    worker?.kill("SIGTERM");
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

  test("a responsible generates, edits and publishes a draft", async ({
    page,
  }) => {
    await login(page, owner);
    await page.goto(`/spaces/${spaceId}`);
    await page.getByRole("link", { name: "Rutas" }).click();
    await page
      .getByLabel("Objetivo de aprendizaje")
      .fill("Aprender a versionar contratos de API");
    await page.getByLabel(/Contratos de API · versión 1/).check();
    await page.getByRole("button", { name: "Generar borrador" }).click();

    await expect(page.getByLabel("Título del paso 1")).toHaveValue(
      "Paso simulado 1",
      { timeout: 20_000 },
    );
    routeUrl = page.url();
    // Sources without code yield general steps; the responsible adds one.
    const codeField = page.getByLabel(/Código de solo lectura/).first();
    await expect(codeField).toHaveValue("");
    await page.getByLabel("Título del paso 1").fill("Versionar contratos");
    await codeField.fill('if (incompatible) {\n  ruta = "/v2";\n}');
    await page.getByLabel("Lenguaje del código (opcional)").first().fill("ts");
    await page.getByRole("button", { name: "Guardar paso 1" }).click();
    await expect(page.getByText("Paso guardado.")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Publicar ruta" }).click();
    await expect(page.getByText("Ruta publicada.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Guardar paso/ }),
    ).toHaveCount(0);
  });

  test("members read the published route without the answer key; other spaces get 404", async ({
    page,
    browser,
  }) => {
    await login(page, member);
    await page.goto(`/spaces/${spaceId}/routes`);
    await page.getByRole("link", { name: "Ruta simulada" }).click();
    await expect(page.getByText("1. Versionar contratos")).toBeVisible();
    expect(await page.locator(".code-block code").textContent()).toBe(
      'if (incompatible) {\n  ruta = "/v2";\n}',
    );
    await expect(page.locator(".code-block figcaption")).toHaveText(
      "Ejemplo ilustrativo: no es código real de la empresa · ts",
    );
    await expect(page.getByText("Respuesta correcta")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Contratos de API" }).first(),
    ).toBeVisible();

    const context = await browser.newContext();
    const foreignPage = await context.newPage();
    await login(foreignPage, foreign);
    expect((await foreignPage.goto(routeUrl))?.status()).toBe(404);
    await context.close();
  });
});
