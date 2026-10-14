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
import { seedPublishedRoute } from "../support/seed-routes.ts";
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
let sourceId: string;
let worker: ChildProcess;

/** Waits until a step or activity swap has finished leaving. */
async function settled(page: Page) {
  await expect(page.locator("[data-exiting]")).toHaveCount(0);
}

async function login(page: Page, identity: LocalTestIdentity) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contraseña").fill(identity.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/spaces$/);
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
    ({ sourceId } = await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Contratos de API",
      sections: [
        "Para versionar contratos de API, un cambio incompatible exige una versión mayor en la ruta.",
      ],
    }));
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
    await page
      .getByRole("navigation", { name: "Espacio" })
      .getByRole("link", { name: "Rutas", exact: true })
      .click();
    await page.getByRole("link", { name: "Crear ruta" }).first().click();
    await expect(page).toHaveURL(/\/routes\/new$/);
    await page
      .getByLabel("Objetivo de aprendizaje")
      .fill("Aprender a versionar contratos de API");
    await page.getByLabel(/Contratos de API · versión 1/).check();
    await expect(page.getByText("1 de 5")).toBeVisible();
    await page.getByRole("button", { name: "Generar borrador" }).click();

    const title = page.getByLabel("Título", { exact: true });
    await expect(title).toHaveValue("Paso simulado 1", { timeout: 20_000 });
    routeUrl = page.url();
    // The queued notice from the URL disappears once the draft is ready.
    await expect(page.getByText("Generación en cola")).toHaveCount(0);
    const kinds = page.locator(".kind-picker");
    const code = page.getByLabel("Código", { exact: true });

    // Sources without code yield general steps; the responsible adds one.
    await title.fill("Versionar contratos");
    await kinds.getByText("Lectura de código", { exact: true }).click();
    await settled(page);
    await code.fill('if (incompatible) {\n  ruta = "/v2";\n}');
    await page.getByLabel("Lenguaje", { exact: true }).fill("ts");
    await expect(page.getByText("Cambios sin guardar").first()).toBeVisible();

    // Changing the activity keeps what was typed.
    await kinds.getByText("Opción múltiple", { exact: true }).click();
    await settled(page);
    await expect(
      page.getByText("El código escrito no se guardará como Opción múltiple"),
    ).toBeVisible();
    await kinds.getByText("Lectura de código", { exact: true }).click();
    await settled(page);
    await expect(code).toHaveValue('if (incompatible) {\n  ruta = "/v2";\n}');

    // Leaving the step with unsaved changes asks first.
    const stepIndex = page.getByRole("navigation", {
      name: "Pasos del borrador",
    });
    await stepIndex.getByRole("button").nth(1).click();
    await settled(page);
    await expect(
      page.getByRole("dialog", { name: "Hay cambios sin guardar" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(title).toHaveValue("Versionar contratos");

    await page.getByRole("button", { name: "Guardar paso" }).click();
    await expect(
      page.getByText("Todos los cambios están guardados."),
    ).toBeVisible();

    // The preview shows the learner's view without the answer key.
    await page.getByRole("button", { name: "Vista previa" }).click();
    const preview = page.getByRole("dialog", { name: "Vista previa del paso" });
    await expect(preview).toContainText("Versionar contratos");
    await expect(preview.getByText("Correcta", { exact: true })).toHaveCount(0);
    await preview.getByRole("button", { name: "Cerrar vista previa" }).click();

    // Discarding returns to the saved text.
    await title.fill("Título descartado");
    await stepIndex.getByRole("button").nth(1).click();
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await settled(page);
    await expect(title).toHaveValue("Paso simulado 2");
    await stepIndex.getByRole("button").nth(0).click();
    await settled(page);
    await expect(title).toHaveValue("Versionar contratos");

    // "Guardar y cambiar" saves before moving to the other step.
    await title.fill("Versionar contratos de API");
    await stepIndex.getByRole("button").nth(1).click();
    await page.getByRole("button", { name: "Guardar y cambiar" }).click();
    // The switch happens once the save answers.
    await expect(stepIndex.getByRole("button").nth(1)).toHaveAttribute(
      "aria-current",
      "step",
    );
    await settled(page);
    await expect(title).toHaveValue("Paso simulado 2");

    // A fill-in step: code with one hole, a main answer and a variant.
    await kinds.getByText("Completar código", { exact: true }).click();
    await settled(page);
    await page
      .getByLabel("Código con hueco", { exact: true })
      .fill("publicar([[hueco]]);");
    await page.getByLabel("Respuesta principal").fill('"/v2"');
    await page.getByRole("button", { name: "Añadir variante" }).click();
    await page.getByLabel("Variante 1").fill("'/v2'");
    await page.getByRole("button", { name: "Guardar paso" }).click();
    await expect(
      page.getByText("Todos los cambios están guardados."),
    ).toBeVisible();
    await stepIndex.getByRole("button").nth(0).click();
    await settled(page);
    await expect(title).toHaveValue("Versionar contratos de API");

    await page.getByRole("button", { name: "Publicar ruta" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Publicar" })
      .click();
    await expect(page.getByText("Ruta publicada.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Guardar paso" }),
    ).toHaveCount(0);
  });

  test("members read the published route without the answer key; other spaces get 404", async ({
    page,
    browser,
  }) => {
    await login(page, member);
    await page.goto(`/spaces/${spaceId}/routes`);
    // Members go straight to the learner flow from the list.
    await expect(
      page.getByRole("link", { name: "Ruta simulada" }),
    ).toHaveAttribute("href", `${new URL(routeUrl).pathname}/learn`);
    await page.goto(routeUrl);
    await expect(
      page.getByRole("heading", { name: "Versionar contratos de API" }),
    ).toBeVisible();
    expect(await page.locator(".code-block code").first().textContent()).toBe(
      'if (incompatible) {\n  ruta = "/v2";\n}',
    );
    await expect(page.locator(".code-block figcaption").first()).toHaveText(
      "Ejemplo ilustrativo: no es código real de la empresa · ts",
    );
    await expect(page.getByText("Respuesta correcta")).toHaveCount(0);
    await page.getByText("Fuentes citadas").first().click();
    await expect(
      page.getByRole("link", { name: "Contratos de API" }).first(),
    ).toBeVisible();

    const context = await browser.newContext();
    const foreignPage = await context.newPage();
    await login(foreignPage, foreign);
    expect((await foreignPage.goto(routeUrl))?.status()).toBe(404);
    await context.close();
  });

  test("a draft lacking requested types explains it and is recovered in place: adjust for free, then generate", async ({
    page,
  }) => {
    const routeId = randomUUID();
    await connection.client`
      insert into public.routes
        (id, space_id, objective, requested_activities, generation_status,
         generation_error, generation_missing_activities, generation_token,
         created_by)
      values (${routeId}, ${spaceId}, 'Aprender los contratos de la API',
        ${["opcion_multiple", "lectura_codigo", "completar"]}, 'fallida',
        'tipos_no_cubiertos', ${["lectura_codigo", "completar"]},
        ${randomUUID()}, ${owner.id})
    `;
    await connection.client`
      insert into public.route_sources (route_id, space_id, source_id)
      values (${routeId}, ${spaceId}, ${sourceId})
    `;
    await login(page, owner);
    await page.goto(
      `/spaces/${spaceId}/routes/${routeId}?notice=generation_queued`,
    );
    await expect(page.getByText("Generación en cola")).toHaveCount(0);
    const panel = page.getByRole("region", {
      name: "Recuperar la generación",
    });
    await expect(panel.getByRole("heading")).toHaveText(
      "Faltaron actividades solicitadas",
    );
    await expect(panel).toContainText(
      "(Opción múltiple, Lectura de código, Completar código). Faltaron: Lectura de código, Completar código.",
    );
    await expect(page.getByText("tipos_no_cubiertos")).toHaveCount(0);
    await expect(page.getByTestId("code-evidence")).toContainText(
      "No detectamos bloques de código en las fuentes seleccionadas",
    );
    await expect(
      panel.getByRole("link", { name: "carga documentos" }),
    ).toHaveAttribute("href", `/spaces/${spaceId}/sources/upload`);

    // Adjusting is free: no attempt is recorded and nothing is queued.
    const attempts = async () =>
      (
        await connection.client`
          select count(*)::int as count from public.route_generation_attempts
          where space_id = ${spaceId}
        `
      )[0].count as number;
    const before = await attempts();
    await panel
      .getByRole("button", { name: "Usar solo opción múltiple" })
      .click();
    await expect(
      page.getByText("Cambios guardados. Todavía no se generó nada."),
    ).toBeVisible();
    await expect(panel.getByLabel("Opción múltiple")).toBeChecked();
    await expect(panel.getByLabel(/Lectura de código/)).not.toBeChecked();
    await expect(panel.getByLabel(/Completar código/)).not.toBeChecked();
    expect(await attempts()).toBe(before);
    await expect(panel).toContainText("Generar consume 1 intento");

    await panel
      .getByLabel("Objetivo de aprendizaje")
      .fill("Aprender a versionar los contratos de la API");
    await panel
      .getByRole("button", { name: "Generar con estos cambios" })
      .click();
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
      "Paso simulado 1",
      { timeout: 20_000 },
    );
    await expect(panel).toHaveCount(0);
    // Next.js adds its own route announcer (role="alert") outside <main>.
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    expect(await attempts()).toBe(before + 1);
    expect(page.url()).toContain(routeId);
  });

  test("an invalid draft shows which check failed, without content", async ({
    page,
  }) => {
    const routeId = randomUUID();
    await connection.client`
      insert into public.routes
        (id, space_id, objective, generation_status, generation_error,
         generation_error_detail, generation_token, created_by)
      values (${routeId}, ${spaceId}, 'Aprender los contratos de la API',
        'fallida', 'borrador_no_valido', 'paso_3:completar:code,acceptedAnswers',
        ${randomUUID()}, ${owner.id})
    `;
    await connection.client`
      insert into public.route_sources (route_id, space_id, source_id)
      values (${routeId}, ${spaceId}, ${sourceId})
    `;
    await login(page, owner);
    await page.goto(`/spaces/${spaceId}/routes/${routeId}`);
    await expect(page.getByTestId("validation-detail")).toContainText(
      "paso 3 (Completar código): código (hueco único), respuestas aceptadas",
    );
    await expect(page.getByText("borrador_no_valido")).toHaveCount(0);
  });

  test("a responsible deletes a draft from the home page; used attempts keep counting", async ({
    page,
    browser,
  }) => {
    // A separate space, so these attempts do not touch the other tests.
    const draftSpaceId = (
      await bootstrapSpace(repository, {
        email: owner.email,
        slug: `${runKey}-drafts`,
        name: "Drafts space",
      })
    ).space.id;
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${draftSpaceId}, ${member.id}, 'integrante')
    `;
    const source = await seedReadySource(connection.client, {
      spaceId: draftSpaceId,
      creatorId: owner.id,
      title: "Guía de borradores",
      sections: ["Contenido sintético para un borrador."],
    });
    const seedDraft = async (title: string, generation: string) => {
      const { routeId } = await seedPublishedRoute(connection.client, {
        spaceId: draftSpaceId,
        creatorId: owner.id,
        title,
        source: { ...source, title: "Guía de borradores" },
        steps: [
          {
            title: "Paso",
            lesson: "Lección [1].",
            question: "¿Pregunta?",
            options: ["Sí", "No", "Quizá"],
            correct: 0,
            explanation: "Explicación [1].",
          },
        ],
      });
      await connection.client`
        update public.routes
        set status = 'borrador', published_by = null, published_at = null,
          generation_status = ${generation}
        where id = ${routeId}
      `;
      return routeId;
    };
    const disposable = await seedDraft("Borrador desechable", "lista");
    await seedDraft("Borrador en marcha", "generando");
    await connection.client`
      insert into public.route_generation_attempts (space_id, route_id)
      values (${draftSpaceId}, ${disposable})
    `;

    // Members never see the action.
    const context = await browser.newContext();
    const memberPage = await context.newPage();
    await login(memberPage, member);
    await memberPage.goto(`/spaces/${draftSpaceId}`);
    await expect(
      memberPage.getByRole("button", { name: /Eliminar el borrador/ }),
    ).toHaveCount(0);
    await context.close();

    await login(page, owner);
    await page.goto(`/spaces/${draftSpaceId}`);
    // A draft being generated waits until it finishes.
    await expect(
      page.getByRole("button", {
        name: "Eliminar el borrador «Borrador en marcha»",
      }),
    ).toBeDisabled();

    // Cancelling keeps it and returns focus.
    const remove = page.getByRole("button", {
      name: "Eliminar el borrador «Borrador desechable»",
    });
    await remove.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("no hay papelera");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(remove).toBeFocused();

    await remove.click();
    await dialog.getByRole("button", { name: "Eliminar borrador" }).click();
    await expect(page.getByText("Borrador eliminado.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/spaces/${draftSpaceId}\\?`));
    await expect(
      page.getByRole("link", { name: "Borrador desechable" }),
    ).toHaveCount(0);

    // The attempt it used still counts, and the deletion is audited.
    const [state] = await connection.client<
      { routes: number; attempts: number; audited: number }[]
    >`
      select
        (select count(*)::int from public.routes
          where id = ${disposable}) as routes,
        (select count(*)::int from public.route_generation_attempts
          where space_id = ${draftSpaceId}) as attempts,
        (select count(*)::int from public.access_audit_events
          where action = 'borrador_eliminado'
            and target_id = ${disposable}) as audited
    `;
    expect(state).toEqual({ routes: 0, attempts: 1, audited: 1 });
  });
});
