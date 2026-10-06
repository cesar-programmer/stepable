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
const runKey = `e5-browser-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let foreign: LocalTestIdentity;
let learnUrl: string;
let fillInUrl: string;
// Markup and indentation must reach the page as literal text.
const snippet = 'if (incompatible) {\n  aviso = "<b id=inyectado>v2</b>";\n}';

async function login(page: Page, identity: LocalTestIdentity) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contraseña").fill(identity.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/protected$/);
}

async function respond(page: Page, stepPosition: number, option: string) {
  await page.getByLabel(option, { exact: false }).check();
  await page
    .getByRole("button", { name: `Responder paso ${stepPosition}` })
    .click();
}

test.describe.serial("E5.1 learner flow in the browser", () => {
  test.beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );
    [owner, member, foreign] = identities;
    const spaceId = (
      await bootstrapSpace(repository, {
        email: owner.email,
        slug: `${runKey}-main`,
        name: "Learning browser space",
      })
    ).space.id;
    await bootstrapSpace(repository, {
      email: foreign.email,
      slug: `${runKey}-foreign`,
      name: "Foreign learning space",
    });
    await connection.client`
      insert into public.profiles (identity_id) values (${member.id})
      on conflict (identity_id) do nothing
    `;
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${spaceId}, ${member.id}, 'integrante')
    `;
    const source = await seedReadySource(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Contratos",
      sections: ["Un cambio incompatible exige una versión mayor."],
    });
    const { routeId } = await seedPublishedRoute(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Ruta de contratos",
      source: { ...source, title: "Contratos" },
      steps: [
        {
          title: "Versionar",
          lesson: "Un cambio incompatible exige una versión mayor [1].",
          question: "¿Qué exige un cambio incompatible?",
          code: {
            content: snippet,
            language: "ts",
            origin: "ilustrativo",
          },
          options: ["Una versión mayor", "Una versión menor", "Nada"],
          correct: 0,
          explanation: "Lo indica la guía de contratos.",
        },
        {
          title: "Revisar",
          lesson: "Otra persona revisa el contrato [1].",
          question: "¿Quién revisa?",
          options: ["Otra persona", "Nadie", "El autor"],
          correct: 0,
          explanation: "Siempre revisa otra persona.",
        },
      ],
    });
    learnUrl = `/spaces/${spaceId}/routes/${routeId}/learn`;
    const fillIn = await seedPublishedRoute(connection.client, {
      spaceId,
      creatorId: owner.id,
      title: "Ruta de completar",
      source: { ...source, title: "Contratos" },
      steps: [
        {
          title: "Completar la versión",
          lesson: "Un cambio incompatible exige una versión mayor [1].",
          question: "Completa la ruta de la nueva versión.",
          code: {
            content: "publicar([[hueco]]);",
            language: "ts",
            origin: "ilustrativo",
          },
          options: [],
          correct: null,
          explanation: "La versión mayor va en la ruta.",
          activityType: "completar",
          acceptedAnswers: ['"/v2"', "'/v2'"],
        },
      ],
    });
    fillInUrl = `/spaces/${spaceId}/routes/${fillIn.routeId}/learn`;
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

  test("a member answers, gets feedback, resumes and completes the route", async ({
    page,
  }) => {
    await login(page, member);
    await page.goto(learnUrl);
    await page.getByRole("button", { name: "Empezar ruta" }).click();

    await expect(page.getByText("Respuesta correcta:")).toHaveCount(0);

    const code = page.locator(".code-block code");
    expect(await code.textContent()).toBe(snippet);
    await expect(page.locator("#inyectado")).toHaveCount(0);
    await expect(
      page.getByText("Ejemplo ilustrativo: no es código real de la empresa"),
    ).toBeVisible();

    // Help before resolving gives hints and does not use an attempt.
    const firstStep = page.locator(".route-steps > li").first();
    await firstStep.getByRole("button", { name: "Pedir ayuda" }).click();
    const hints = firstStep.getByRole("region", {
      name: "Respuesta del asistente",
    });
    await expect(hints).toContainText("Ayuda para comprender");
    await expect(hints).toContainText("Pista simulada");
    await expect(hints.getByRole("link", { name: "Contratos" })).toBeVisible();
    await page.reload();
    await expect(firstStep.getByText("Intento 1 de 3")).toBeVisible();

    await respond(page, 1, "B. Una versión menor");
    await expect(page.getByText("Te quedan 2 intentos.")).toBeVisible();
    await expect(page.getByText("Respuesta correcta:")).toHaveCount(0);
    await respond(page, 1, "A. Una versión mayor");
    await expect(
      page.getByText("Respuesta correcta.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Lo indica la guía de contratos."),
    ).toBeVisible();

    // Once resolved, help explains the answer.
    await firstStep.getByRole("button", { name: "Pedir ayuda" }).click();
    await expect(
      firstStep.getByRole("region", { name: "Respuesta del asistente" }),
    ).toContainText("Explicación simulada");

    // Returning later keeps the stored progress.
    await page.goto(learnUrl);
    await expect(page.getByTestId("learning-summary")).toContainText(
      "pasos resueltos 1 de 2 · acertados 1 de 2",
    );

    // Each answer waits for its feedback: resubmitting a stale form would
    // reuse its submission id and, by design, not count as a new attempt.
    await respond(page, 2, "B. Nadie");
    await expect(page.getByText("Te quedan 2 intentos.")).toBeVisible();
    await respond(page, 2, "B. Nadie");
    await expect(page.getByText("Te queda 1 intento.")).toBeVisible();
    await respond(page, 2, "B. Nadie");
    await expect(page.getByText("Se agotaron los intentos.")).toBeVisible();
    await expect(page.getByTestId("learning-summary")).toContainText(
      "Ruta completada · pasos resueltos 2 de 2 · acertados 1 de 2. Completar la ruta no implica dominio del contenido.",
    );
  });

  test("the responsible sees team totals; members cannot open them", async ({
    page,
    browser,
  }) => {
    const progressUrl = learnUrl.replace(/\/learn$/, "/progress");
    await login(page, owner);
    await page.goto(progressUrl);
    await expect(page.getByTestId("team-summary")).toContainText(
      "Miembros activos: 2 · empezaron: 1 · completaron: 1",
    );
    const row = page.getByRole("row", { name: new RegExp(member.email) });
    await expect(row).toContainText("Completada");
    await expect(row.getByRole("cell").nth(1)).toHaveText("2 de 2");
    await expect(row.getByRole("cell").nth(2)).toHaveText("1 de 2");
    await expect(
      page.getByRole("row", { name: new RegExp(owner.email) }),
    ).toContainText("No empezada");
    await expect(
      page.getByText("no implica dominio del contenido"),
    ).toBeVisible();

    const context = await browser.newContext();
    const memberPage = await context.newPage();
    await login(memberPage, member);
    expect((await memberPage.goto(progressUrl))?.status()).toBe(404);
    await context.close();
  });

  test("a member completes a code hole with an exact answer", async ({
    page,
  }) => {
    await login(page, member);
    await page.goto(fillInUrl);
    await page.getByRole("button", { name: "Empezar ruta" }).click();
    await expect(page.locator(".code-hole")).toHaveText("[[hueco]]");
    await expect(
      page.getByText("Una solución equivalente pero distinta no se acepta."),
    ).toBeVisible();
    await expect(page.getByText("Solución:")).toHaveCount(0);

    const field = page.getByLabel("Texto para el hueco del paso 1");
    await field.fill("/v2");
    await page.getByRole("button", { name: "Responder paso 1" }).click();
    await expect(page.getByText("Te quedan 2 intentos.")).toBeVisible();
    await expect(page.getByText("Solución:")).toHaveCount(0);

    await field.fill("  '/v2'  ");
    await page.getByRole("button", { name: "Responder paso 1" }).click();
    await expect(
      page.getByText("Respuesta correcta.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Solución:")).toContainText('"/v2"');
    await expect(page.getByTestId("learning-summary")).toContainText(
      "Ruta completada · pasos resueltos 1 de 1 · acertados 1 de 1",
    );
  });

  test("another space cannot open the learner view", async ({ page }) => {
    await login(page, foreign);
    expect((await page.goto(learnUrl))?.status()).toBe(404);
  });
});
