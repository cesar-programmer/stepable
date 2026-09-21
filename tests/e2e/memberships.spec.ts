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

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const repository = new PostgresAccessRepository(connection.database);
const runKey = `e1-6-browser-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];
let owner: LocalTestIdentity;
let member: LocalTestIdentity;
let revoked: LocalTestIdentity;
let foreign: LocalTestIdentity;
let leavingMember: LocalTestIdentity;
let managementSpaceId: string;
let retainedSpaceId: string;
let leaveSpaceId: string;

async function login(page: Page, identity: LocalTestIdentity) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contraseña").fill(identity.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/protected$/);
}

async function addMember(
  spaceId: string,
  identity: LocalTestIdentity,
  role: "responsable" | "integrante" = "integrante",
  status: "activa" | "revocada" = "activa",
) {
  await connection.client`
    insert into public.profiles (identity_id)
    values (${identity.id})
    on conflict (identity_id) do nothing
  `;
  await connection.client`
    insert into public.memberships (space_id, profile_id, role, status)
    values (${spaceId}, ${identity.id}, ${role}, ${status})
  `;
}

async function confirmClick(page: Page, buttonName: string) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: buttonName }).click();
}

test.describe.serial("membership administration browser flows", () => {
  test.beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );
    [owner, member, revoked, foreign, leavingMember] = identities;
    managementSpaceId = (
      await bootstrapSpace(repository, {
        email: owner.email,
        slug: `${runKey}-management`,
        name: "Membership browser space",
      })
    ).space.id;
    retainedSpaceId = (
      await bootstrapSpace(repository, {
        email: member.email,
        slug: `${runKey}-retained`,
        name: "Retained browser space",
      })
    ).space.id;
    leaveSpaceId = (
      await bootstrapSpace(repository, {
        email: owner.email,
        slug: `${runKey}-leave`,
        name: "Leave browser space",
      })
    ).space.id;
    await bootstrapSpace(repository, {
      email: foreign.email,
      slug: `${runKey}-foreign`,
      name: "Foreign browser space",
    });
    await addMember(managementSpaceId, member);
    await addMember(managementSpaceId, revoked, "integrante", "revocada");
    await addMember(leaveSpaceId, leavingMember);
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

  test("shows active and revoked members only to a responsible", async ({
    page,
    browser,
  }) => {
    await login(page, owner);
    await page.goto(`/spaces/${managementSpaceId}/members`);
    await expect(page.getByText(member.email, { exact: true })).toBeVisible();
    await expect(page.getByText(revoked.email, { exact: true })).toBeVisible();
    await expect(page.getByText(foreign.email, { exact: true })).toHaveCount(0);
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: revoked.email })
        .getByText("revocada"),
    ).toBeVisible();

    const context = await browser.newContext();
    const memberPage = await context.newPage();
    await login(memberPage, member);
    const response = await memberPage.goto(
      `/spaces/${managementSpaceId}/members`,
    );
    expect(response?.status()).toBe(404);
    await context.close();
  });

  test("reflects promotion, self-demotion and revocation in open sessions", async ({
    page,
    browser,
  }) => {
    await login(page, owner);
    await page.goto(`/spaces/${managementSpaceId}/members`);
    let memberRow = page
      .getByRole("listitem")
      .filter({ hasText: member.email });
    await memberRow.getByRole("combobox").selectOption("responsable");
    page.once("dialog", (dialog) => dialog.accept());
    await memberRow.getByRole("button", { name: "Guardar rol" }).click();
    await expect(page.getByText("Rol actualizado.")).toBeVisible();

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await login(memberPage, member);
    await memberPage.goto(`/spaces/${managementSpaceId}`);
    await expect(memberPage.getByText("responsable")).toBeVisible();
    await expect(
      memberPage.getByRole("link", { name: "Gestionar miembros" }),
    ).toBeVisible();

    const ownerRow = page
      .getByRole("listitem")
      .filter({ hasText: owner.email });
    await ownerRow.getByRole("combobox").selectOption("integrante");
    page.once("dialog", (dialog) => dialog.accept());
    await ownerRow.getByRole("button", { name: "Guardar rol" }).click();
    await expect(page).toHaveURL(new RegExp(`/spaces/${managementSpaceId}`));
    await expect(page.getByText("Tu rol ahora es integrante.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Gestionar miembros" }),
    ).toHaveCount(0);

    await memberPage.goto(`/spaces/${managementSpaceId}/members`);
    const demotedOwnerRow = memberPage
      .getByRole("listitem")
      .filter({ hasText: owner.email });
    await demotedOwnerRow.getByRole("combobox").selectOption("responsable");
    memberPage.once("dialog", (dialog) => dialog.accept());
    await demotedOwnerRow.getByRole("button", { name: "Guardar rol" }).click();
    await expect(memberPage.getByText("Rol actualizado.")).toBeVisible();

    await page.goto(`/spaces/${managementSpaceId}/members`);
    memberRow = page.getByRole("listitem").filter({ hasText: member.email });
    page.once("dialog", (dialog) => dialog.accept());
    await memberRow.getByRole("button", { name: "Retirar acceso" }).click();
    await expect(page.getByText("Acceso retirado.")).toBeVisible();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: member.email })
        .getByText("Reactivación solo por invitación"),
    ).toBeVisible();

    const denied = await memberPage.goto(`/spaces/${managementSpaceId}`);
    expect(denied?.status()).toBe(404);
    await memberPage.goto("/protected");
    await expect(
      memberPage.getByRole("heading", { name: "Sesión validada" }),
    ).toBeVisible();
    await memberPage.goto(`/spaces/${retainedSpaceId}`);
    await expect(
      memberPage.getByRole("heading", { name: "Retained browser space" }),
    ).toBeVisible();
    await memberContext.close();
  });

  test("lets a member leave but keeps the last responsible", async ({
    page,
    browser,
  }) => {
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await login(memberPage, leavingMember);
    await memberPage.goto(`/spaces/${leaveSpaceId}`);
    await confirmClick(memberPage, "Abandonar espacio");
    await expect(memberPage).toHaveURL(/\/spaces\?notice=left-space$/);
    await expect(
      memberPage.getByText("Ya no tienes acceso a ese espacio."),
    ).toBeVisible();
    await memberContext.close();

    await login(page, owner);
    await page.goto(`/spaces/${leaveSpaceId}/members`);
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: leavingMember.email })
        .getByText("revocada"),
    ).toBeVisible();
    await page.goto(`/spaces/${leaveSpaceId}`);
    await confirmClick(page, "Abandonar espacio");
    await expect(
      page.getByText(
        "No puedes salir ni degradarte si eres el último responsable activo.",
      ),
    ).toBeVisible();
  });
});
