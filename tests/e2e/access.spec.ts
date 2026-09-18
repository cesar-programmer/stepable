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
} from "../support/local-auth";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const repository = new PostgresAccessRepository(connection.database);
const runKey = `e1-4-browser-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let ownSpaceId: string;
let foreignSpaceId: string;
let revokedSpaceId: string;
let retainedSpaceId: string;

async function login(page: Page, identity: LocalTestIdentity) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contraseña").fill(identity.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/protected$/);
}

test.describe.serial("spaces and membership isolation", () => {
  test.beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );

    ownSpaceId = (
      await bootstrapSpace(repository, {
        email: identities[0].email,
        slug: `${runKey}-own`,
        name: "Own browser space",
      })
    ).space.id;
    foreignSpaceId = (
      await bootstrapSpace(repository, {
        email: identities[1].email,
        slug: `${runKey}-foreign`,
        name: "Foreign browser space",
      })
    ).space.id;
    revokedSpaceId = (
      await bootstrapSpace(repository, {
        email: identities[0].email,
        slug: `${runKey}-revoked`,
        name: "Revoked browser space",
      })
    ).space.id;
    retainedSpaceId = (
      await bootstrapSpace(repository, {
        email: identities[0].email,
        slug: `${runKey}-retained`,
        name: "Retained browser space",
      })
    ).space.id;
    await connection.client`
      insert into public.profiles (identity_id)
      values (${identities[3].id})
      on conflict (identity_id) do nothing
    `;
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values
        (${revokedSpaceId}, ${identities[3].id}, 'integrante'),
        (${retainedSpaceId}, ${identities[3].id}, 'integrante')
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

  test("shows only spaces from the current membership", async ({ page }) => {
    await login(page, identities[0]);
    await page.goto("/spaces");

    await expect(
      page.getByRole("link", { name: "Own browser space" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Own browser space" })
        .getByText("responsable"),
    ).toBeVisible();
    await expect(page.getByText("Foreign browser space")).toHaveCount(0);

    await page.getByRole("link", { name: "Own browser space" }).click();
    await expect(page).toHaveURL(new RegExp(`/spaces/${ownSpaceId}$`));
    await expect(
      page.getByRole("heading", { name: "Own browser space" }),
    ).toBeVisible();

    const foreignResponse = await page.goto(`/spaces/${foreignSpaceId}`);
    expect(foreignResponse?.status()).toBe(404);
  });

  test("shows an empty state for an identity without memberships", async ({
    page,
  }) => {
    await login(page, identities[2]);
    await page.goto("/spaces");
    await expect(
      page.getByText("Todavía no perteneces a ningún espacio."),
    ).toBeVisible();
    await expect(page.locator(".space-list")).toHaveCount(0);
  });

  test("applies revocation on the next request while preserving the global session", async ({
    page,
  }) => {
    await login(page, identities[3]);
    await page.goto(`/spaces/${revokedSpaceId}`);
    await expect(
      page.getByRole("heading", { name: "Revoked browser space" }),
    ).toBeVisible();

    await connection.client`
      update public.memberships
      set status = 'revocada'
      where space_id = ${revokedSpaceId}
        and profile_id = ${identities[3].id}
    `;

    const revokedResponse = await page.goto(`/spaces/${revokedSpaceId}`);
    expect(revokedResponse?.status()).toBe(404);

    await page.goto("/protected");
    await expect(
      page.getByRole("heading", { name: "Sesión validada en el servidor" }),
    ).toBeVisible();

    await page.goto(`/spaces/${retainedSpaceId}`);
    await expect(
      page.getByRole("heading", { name: "Retained browser space" }),
    ).toBeVisible();
  });
});
