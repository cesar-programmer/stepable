import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import { sourceBucket } from "../../src/adapters/supabase/source-storage.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import {
  createAdminClient,
  createLocalTestIdentity,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
} from "../support/local-auth.ts";
import { syntheticPdf } from "../support/synthetic-pdf.ts";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const repository = new PostgresAccessRepository(connection.database);
const runKey = `e2-1-browser-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let foreign: LocalTestIdentity;
let spaceId: string;
let worker: ChildProcess;

async function login(page: Page, identity: LocalTestIdentity) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contraseña").fill(identity.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/protected$/);
}

async function uploadFile(page: Page, name: string, buffer: Buffer) {
  await page.getByLabel(/^Archivo Markdown/).setInputFiles({
    name,
    mimeType: name.endsWith(".pdf") ? "application/pdf" : "text/markdown",
    buffer,
  });
  await page.getByRole("button", { name: "Cargar fuente" }).click();
}

function startWorker(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--experimental-strip-types", "src/worker/main.ts"],
      {
        // Source tests never index embeddings over the shared local database.
        env: { ...process.env, STEPABLE_AI_EMBEDDINGS_MODE: "desactivado" },
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

test.describe.serial("E2 sources in the browser", () => {
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
        name: "Sources browser space",
      })
    ).space.id;
    await bootstrapSpace(repository, {
      email: foreign.email,
      slug: `${runKey}-foreign`,
      name: "Foreign sources space",
    });
    await connection.client`
      insert into public.profiles (identity_id) values (${member.id})
      on conflict (identity_id) do nothing
    `;
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${spaceId}, ${member.id}, 'integrante')
    `;
    worker = await startWorker();
  });

  test.afterAll(async () => {
    worker?.kill("SIGTERM");
    const objects = await connection.client<{ name: string }[]>`
      select name from storage.objects
      where bucket_id = ${sourceBucket} and name like ${`${spaceId}/%`}
    `;
    if (objects.length > 0) {
      await admin.storage
        .from(sourceBucket)
        .remove(objects.map((object) => object.name));
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
  });

  test("a responsible uploads Markdown, sees it processed and reads its content", async ({
    page,
  }) => {
    await login(page, owner);
    await page.goto(`/spaces/${spaceId}`);
    await page.getByRole("link", { name: "Fuentes" }).click();
    await expect(page).toHaveURL(new RegExp(`/spaces/${spaceId}/sources$`));

    await uploadFile(
      page,
      "convenciones-api.md",
      Buffer.from(
        "# Convenciones de API\nVersionar contratos.\n## Errores\nUsar códigos estables.",
      ),
    );
    await expect(page.getByText("Fuente recibida")).toBeVisible();
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "convenciones-api" });
    await expect(row.getByText("Lista")).toBeVisible({ timeout: 20_000 });
    await expect(row.getByText("2 secciones")).toBeVisible();

    await row.getByRole("link", { name: "convenciones-api" }).click();
    await expect(page.getByText("Usar códigos estables.")).toBeVisible();
    await expect(
      page.getByText("Convenciones de API › Errores · líneas 3–4"),
    ).toBeVisible();
  });

  test("invalid files are rejected or shown as failed with a reason", async ({
    page,
  }) => {
    await login(page, owner);
    await page.goto(`/spaces/${spaceId}/sources`);

    await uploadFile(page, "notas.txt", Buffer.from("texto"));
    await expect(
      page.getByText("Solo se admiten archivos Markdown"),
    ).toBeVisible();

    await uploadFile(page, "binario.md", Buffer.from([0xff, 0xfe, 0x00]));
    const row = page.getByRole("listitem").filter({ hasText: "binario" });
    await expect(row.getByText("Falló")).toBeVisible({ timeout: 20_000 });
    await expect(
      row.getByText("El archivo no es texto UTF-8 válido."),
    ).toBeVisible();
  });

  test("a responsible uploads a text PDF, reads it by page and sees scanned PDFs fail", async ({
    page,
  }) => {
    await login(page, owner);
    await page.goto(`/spaces/${spaceId}/sources`);

    await uploadFile(
      page,
      "manual-equipo.pdf",
      syntheticPdf([
        "Revisar contratos antes de publicar",
        null,
        "Fin del manual",
      ]),
    );
    const row = page.getByRole("listitem").filter({ hasText: "manual-equipo" });
    await expect(row.getByText("Lista")).toBeVisible({ timeout: 20_000 });
    await expect(
      row.getByText("PDF · versión 1 · 3 páginas · 2 con texto"),
    ).toBeVisible();
    await row.getByRole("link", { name: "manual-equipo" }).click();
    await expect(page.getByText("Página 3")).toBeVisible();
    await expect(
      page.getByText("Revisar contratos antes de publicar"),
    ).toBeVisible();

    await page.goto(`/spaces/${spaceId}/sources`);
    await uploadFile(page, "escaneado.pdf", syntheticPdf([null]));
    const scanned = page.getByRole("listitem").filter({ hasText: "escaneado" });
    await expect(scanned.getByText("Falló")).toBeVisible({ timeout: 20_000 });
    await expect(
      scanned.getByText("El PDF no contiene texto extraíble", { exact: false }),
    ).toBeVisible();
  });

  test("a responsible replaces a source, keeps it on failure and can retry", async ({
    page,
    browser,
  }) => {
    await login(page, owner);
    await page.goto(`/spaces/${spaceId}/sources`);
    await uploadFile(
      page,
      "guia-reemplazo.md",
      Buffer.from("# Guía\nTexto original"),
    );
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "guia-reemplazo" });
    await expect(row.getByText("Lista")).toBeVisible({ timeout: 20_000 });
    await row.getByRole("link", { name: "guia-reemplazo" }).click();
    await expect(page).toHaveURL(/\/sources\/[0-9a-f-]{36}$/);
    const detailUrl = page.url();

    const replaceWith = async (name: string, buffer: Buffer) => {
      await page.getByLabel(/^Reemplazar con otro archivo/).setInputFiles({
        name,
        mimeType: name.endsWith(".pdf") ? "application/pdf" : "text/markdown",
        buffer,
      });
      await page.getByRole("button", { name: "Reemplazar archivo" }).click();
    };

    await replaceWith("nueva.pdf", syntheticPdf(["Texto nuevo en PDF"]));
    await expect(page.getByText("Texto nuevo en PDF")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Fuente · versión 2")).toBeVisible();

    await replaceWith("rota.md", Buffer.from([0xff, 0xfe, 0x00]));
    await expect(
      page.getByText("La versión vigente sigue disponible."),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("El archivo no es texto UTF-8 válido."),
    ).toBeVisible();
    await expect(page.getByText("Texto nuevo en PDF")).toBeVisible();
    await page
      .getByRole("button", { name: /Reintentar procesamiento \(quedan 3\)/ })
      .click();
    await expect(
      page.getByRole("button", {
        name: /Reintentar procesamiento \(quedan 2\)/,
      }),
    ).toBeVisible({ timeout: 20_000 });

    const context = await browser.newContext();
    const memberPage = await context.newPage();
    await login(memberPage, member);
    await memberPage.goto(detailUrl);
    await expect(memberPage.getByText("Texto nuevo en PDF")).toBeVisible();
    await expect(
      memberPage.getByRole("button", {
        name: /Reemplazar archivo|Reintentar|Eliminar fuente/,
      }),
    ).toHaveCount(0);
    const memberReplace = await memberPage.request.post(
      `${detailUrl}/replace`,
      {
        multipart: {
          file: {
            name: "x.md",
            mimeType: "text/markdown",
            buffer: Buffer.from("x"),
          },
        },
        maxRedirects: 0,
      },
    );
    expect(memberReplace.status()).toBe(404);
    await context.close();
  });

  test("a responsible deletes a disposable source after explicit confirmation", async ({
    page,
  }) => {
    await login(page, owner);
    await page.goto(`/spaces/${spaceId}/sources`);
    await uploadFile(
      page,
      "desechable.md",
      Buffer.from("# Desechable\nBorrar"),
    );
    const row = page.getByRole("listitem").filter({ hasText: "desechable" });
    await expect(row.getByText("Lista")).toBeVisible({ timeout: 20_000 });
    await row.getByRole("link", { name: "desechable" }).click();
    await expect(page).toHaveURL(/\/sources\/[0-9a-f-]{36}$/);
    const detailUrl = page.url();

    await page.getByLabel(/Entiendo que se eliminarán la fuente/).check();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Eliminar fuente" }).click();
    await expect(page.getByText("Fuente eliminada.")).toBeVisible();
    await expect(page.getByRole("link", { name: "desechable" })).toHaveCount(0);
    expect((await page.goto(detailUrl))?.status()).toBe(404);
  });

  test("a member reads only ready sources and other spaces get 404", async ({
    page,
    browser,
  }) => {
    const [ready] = await connection.client<{ id: string }[]>`
      select id from public.sources
      where space_id = ${spaceId} and title = 'convenciones-api'
    `;

    await login(page, member);
    await page.goto(`/spaces/${spaceId}/sources`);
    await expect(
      page.getByRole("link", { name: "convenciones-api" }),
    ).toBeVisible();
    await expect(page.getByText("binario")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Cargar fuente" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "convenciones-api" }).click();
    await expect(page.getByText("Versionar contratos.")).toBeVisible();

    const memberUpload = await page.request.post(
      `/spaces/${spaceId}/sources/upload`,
      {
        multipart: {
          file: {
            name: "intento.md",
            mimeType: "text/markdown",
            buffer: Buffer.from("x"),
          },
        },
        maxRedirects: 0,
      },
    );
    expect(memberUpload.status()).toBe(404);

    const crossOrigin = await page.request.post(
      `/spaces/${spaceId}/sources/upload`,
      {
        headers: { Origin: "http://otro-sitio.test" },
        multipart: {
          file: {
            name: "intento.md",
            mimeType: "text/markdown",
            buffer: Buffer.from("x"),
          },
        },
        maxRedirects: 0,
      },
    );
    expect(crossOrigin.status()).toBe(403);

    const context = await browser.newContext();
    const foreignPage = await context.newPage();
    await login(foreignPage, foreign);
    expect(
      (await foreignPage.goto(`/spaces/${spaceId}/sources`))?.status(),
    ).toBe(404);
    expect(
      (
        await foreignPage.goto(`/spaces/${spaceId}/sources/${ready.id}`)
      )?.status(),
    ).toBe(404);
    await context.close();
  });
});
