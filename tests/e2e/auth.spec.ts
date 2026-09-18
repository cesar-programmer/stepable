import { expect, test } from "@playwright/test";

import {
  createAdminClient,
  createLocalTestIdentity,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
  waitForRecoveryLink,
} from "../support/local-auth";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
let identity: LocalTestIdentity;

test.describe.serial("identity and session", () => {
  test.beforeAll(async () => {
    identity = await createLocalTestIdentity(admin);
  });

  test.afterAll(async () => {
    if (identity?.id) {
      await deleteLocalTestIdentity(admin, identity.id);
    }
  });

  test("login, protected session, logout and recovery", async ({ page }) => {
    await page.goto("/protected");
    await expect(page).toHaveURL(
      /\/login\?next=%2Fprotected|\/login\?next=\/protected/,
    );

    await page.getByLabel("Correo").fill(identity.email);
    await page.getByLabel("Contraseña").fill(`${identity.password}-incorrect`);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("p.error")).toContainText("incorrectos");

    await page.getByLabel("Correo").fill(identity.email);
    await page.getByLabel("Contraseña").fill(identity.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/protected$/);
    await expect(
      page.getByRole("heading", { name: "Sesión validada en el servidor" }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Sesión validada en el servidor" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login\?notice=signed-out/);
    await page.goto("/protected");
    await expect(page).toHaveURL(/\/login\?next=/);

    await page.goto("/recover");
    await page.getByLabel("Correo").fill(identity.email);
    await page.getByRole("button", { name: "Enviar enlace local" }).click();
    await expect(
      page.getByText("encontrarás un enlace en Mailpit"),
    ).toBeVisible();

    const recoveryLink = await waitForRecoveryLink(
      config.mailpitUrl,
      identity.email,
    );
    await page.goto(recoveryLink);
    await expect(
      page.getByRole("heading", { name: "Establecer contraseña" }),
    ).toBeVisible();
    await page
      .getByLabel("Nueva contraseña", { exact: true })
      .fill(identity.updatedPassword);
    await page
      .getByLabel("Confirmar contraseña")
      .fill(identity.updatedPassword);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL(/\/login\?notice=password-updated/);

    await page.goto(recoveryLink);
    await expect(page).toHaveURL(/\/login\?error=invalid-link/);
    await expect(page.locator("p.error")).toContainText(
      "no es válido o ya fue utilizado",
    );

    await page.getByLabel("Correo").fill(identity.email);
    await page.getByLabel("Contraseña").fill(identity.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("p.error")).toContainText("incorrectos");

    await page.getByLabel("Correo").fill(identity.email);
    await page.getByLabel("Contraseña").fill(identity.updatedPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/protected$/);
  });

  test("does not expose the administrative key in browser assets", async ({
    page,
  }) => {
    const response = await page.request.get("/");
    const html = await response.text();
    const assets = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const contents = [html];

    for (const asset of assets) {
      const assetResponse = await page.request.get(asset);
      contents.push(await assetResponse.text());
    }

    if (contents.some((content) => content.includes(config.serviceRoleKey))) {
      throw new Error(
        "La clave administrativa apareció en un recurso accesible al navegador.",
      );
    }

    expect(assets.length).toBeGreaterThan(0);
  });
});
