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
  waitForAccountSetupLink,
  waitForInvitationLink,
} from "../support/local-auth.ts";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const repository = new PostgresAccessRepository(connection.database);
const runKey = `e1-5-browser-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let existingInvitee: LocalTestIdentity;
let spaceId: string;

async function login(page: Page, identity: LocalTestIdentity) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contraseña").fill(identity.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/protected$/);
}

async function createInvitation(
  page: Page,
  email: string,
  role: "responsable" | "integrante" = "integrante",
) {
  await page.goto(`/spaces/${spaceId}/invitations`);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Rol").selectOption(role);
  await page.getByRole("button", { name: "Enviar invitación" }).click();
  await expect(page.getByText("Invitación enviada a Mailpit.")).toBeVisible();
}

async function findIdentityId(email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email === email)?.id ?? null;
}

test.describe.serial("space invitation browser flows", () => {
  test.beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );
    [owner, member, existingInvitee] = identities;
    spaceId = (
      await bootstrapSpace(repository, {
        email: owner.email,
        slug: `${runKey}-space`,
        name: "Invitation browser space",
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

  test("existing user explicitly accepts a responsible invitation", async ({
    page,
    browser,
  }) => {
    await login(page, owner);
    await createInvitation(page, existingInvitee.email, "responsable");
    const invitationLink = await waitForInvitationLink(
      config.mailpitUrl,
      existingInvitee.email,
    );

    const context = await browser.newContext();
    const inviteePage = await context.newPage();
    await login(inviteePage, existingInvitee);
    await inviteePage.goto(invitationLink);
    await expect(
      inviteePage.getByText("Invitation browser space"),
    ).toBeVisible();
    const before = await connection.client`
      select 1 from public.memberships
      where space_id = ${spaceId} and profile_id = ${existingInvitee.id}
    `;
    expect(before).toHaveLength(0);

    await inviteePage
      .getByRole("button", { name: "Aceptar invitación" })
      .click();
    await expect(inviteePage).toHaveURL(new RegExp(`/spaces/${spaceId}$`));
    await expect(inviteePage.getByText("responsable")).toBeVisible();
    await context.close();
  });

  test("new user establishes Auth identity separately and then accepts", async ({
    page,
    browser,
  }) => {
    const email = `new-${randomUUID()}@example.test`;
    const password = `Invited-${randomUUID()}!`;
    await login(page, owner);
    await createInvitation(page, email);
    const invitationLink = await waitForInvitationLink(
      config.mailpitUrl,
      email,
    );

    const context = await browser.newContext();
    const inviteePage = await context.newPage();
    await inviteePage.goto(invitationLink);
    await expect(
      inviteePage.getByText("Invitation browser space"),
    ).toBeVisible();
    await inviteePage
      .getByRole("button", { name: "Configurar cuenta nueva" })
      .click();
    await expect(inviteePage.getByText("Revisa Mailpit")).toBeVisible();
    const invitedId = await findIdentityId(email);
    expect(invitedId).not.toBeNull();
    if (invitedId) {
      identities.push({
        id: invitedId,
        email,
        password,
        updatedPassword: password,
      });
    }

    const accountLink = await waitForAccountSetupLink(config.mailpitUrl, email);
    await inviteePage.goto(accountLink);
    await expect(
      inviteePage.getByRole("heading", { name: "Establecer contraseña" }),
    ).toBeVisible();
    await inviteePage
      .getByLabel("Nueva contraseña", { exact: true })
      .fill(password);
    await inviteePage.getByLabel("Confirmar contraseña").fill(password);
    await inviteePage
      .getByRole("button", { name: "Guardar contraseña" })
      .click();
    await expect(inviteePage).toHaveURL(/\/login\?notice=password-updated/);
    await inviteePage.getByLabel("Correo").fill(email);
    await inviteePage.getByLabel("Contraseña").fill(password);
    await inviteePage.getByRole("button", { name: "Entrar" }).click();
    await expect(inviteePage).toHaveURL(/\/invitations\/accept$/);
    await inviteePage
      .getByRole("button", { name: "Aceptar invitación" })
      .click();
    await expect(inviteePage).toHaveURL(new RegExp(`/spaces/${spaceId}$`));
    await expect(inviteePage.getByText("integrante")).toBeVisible();

    await context.close();
  });

  test("resend invalidates the old link, cancellation invalidates the new one, and members cannot manage", async ({
    page,
    browser,
  }) => {
    const target = await createLocalTestIdentity(admin);
    identities.push(target);
    await login(page, owner);
    await createInvitation(page, target.email);
    const oldLink = await waitForInvitationLink(
      config.mailpitUrl,
      target.email,
    );
    const item = page.getByRole("listitem").filter({ hasText: target.email });
    await item.getByRole("button", { name: "Reenviar" }).click();
    await expect(page.getByText("Invitación enviada a Mailpit.")).toBeVisible();
    const newLink = await waitForInvitationLink(
      config.mailpitUrl,
      target.email,
      oldLink,
    );

    const context = await browser.newContext();
    const targetPage = await context.newPage();
    await targetPage.goto(oldLink);
    await expect(
      targetPage.getByText("no es válido o fue reemplazado"),
    ).toBeVisible();
    await targetPage.goto("/");
    await targetPage.goto(newLink);
    await expect(
      targetPage.getByText("Invitation browser space"),
    ).toBeVisible();

    const refreshedItem = page
      .getByRole("listitem")
      .filter({ hasText: target.email });
    await refreshedItem.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Invitación cancelada.")).toBeVisible();
    await targetPage.reload();
    await expect(targetPage.getByText("ya no está pendiente")).toBeVisible();
    await context.close();

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await login(memberPage, member);
    const response = await memberPage.goto(`/spaces/${spaceId}/invitations`);
    expect(response?.status()).toBe(404);
    await memberContext.close();
  });
});
