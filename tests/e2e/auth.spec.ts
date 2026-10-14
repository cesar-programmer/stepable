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

  test("login, session, logout and recovery", async ({ page }) => {
    await page.goto("/spaces");
    await expect(page).toHaveURL(
      /\/login\?next=%2Fspaces|\/login\?next=\/spaces/,
    );

    await page.getByLabel("Correo").fill(identity.email);
    await page.getByLabel("Contraseña").fill(`${identity.password}-incorrect`);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("p.error")).toContainText("incorrectos");

    await page.getByLabel("Correo").fill(identity.email);
    await page.getByLabel("Contraseña").fill(identity.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/spaces$/);
    await expect(
      page.getByRole("heading", { name: "Tus espacios" }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Tus espacios" }),
    ).toBeVisible();
    // The former landing page still leads to the spaces.
    await page.goto("/protected");
    await expect(page).toHaveURL(/\/spaces$/);

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login\?notice=signed-out/);
    await page.goto("/spaces");
    await expect(page).toHaveURL(/\/login\?next=/);

    await page.goto("/recover");
    await page.getByLabel("Correo").fill(identity.email);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(
      page.getByText("encontrarás un enlace en Mailpit"),
    ).toBeVisible();

    const recoveryLink = await waitForRecoveryLink(
      config.mailpitUrl,
      identity.email,
    );
    await page.goto(recoveryLink);
    await expect(
      page.getByRole("heading", { name: "Elige una contraseña nueva" }),
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
    await expect(page).toHaveURL(/\/spaces$/);
  });

  test("does not expose server credentials in browser assets", async ({
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

    const serverOnlyValues = [
      config.serviceRoleKey,
      config.databaseUrl,
      identity.password,
      identity.updatedPassword,
    ];
    if (
      contents.some((content) =>
        serverOnlyValues.some((value) => content.includes(value)),
      )
    ) {
      throw new Error(
        "Una credencial de servidor apareció en un recurso accesible al navegador.",
      );
    }

    expect(assets.length).toBeGreaterThan(0);
  });

  test("the chosen theme is kept on this device and rendered by the server", async ({
    page,
  }) => {
    await page.goto("/login");
    const html = page.locator("html");
    await expect(html).not.toHaveAttribute("data-theme", /.+/);

    await page.getByRole("button", { name: "Tema oscuro" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(
      page.getByRole("button", { name: "Tema oscuro" }),
    ).toHaveAttribute("aria-pressed", "true");

    // The server reads the cookie: no flash of the other theme.
    const response = await page.reload();
    expect(await response?.text()).toContain('data-theme="dark"');

    await page.getByRole("button", { name: "Tema del sistema" }).click();
    await expect(html).not.toHaveAttribute("data-theme", /.+/);
    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name === "stepable-tema")).toBe(
      false,
    );
  });
});
