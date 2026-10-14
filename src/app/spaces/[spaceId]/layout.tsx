import type { ReactNode } from "react";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { SpaceShell, type NavItem } from "@/app/components/space-shell";
import {
  allowsSpaceAction,
  authorizeSpaceAction,
  listAuthorizedSpaces,
} from "@/modules/access/authorization";
import type { SpaceAction } from "@/modules/access/contract";
import { spaceIdSchema } from "@/modules/access/input";

const items: (Omit<NavItem, "href"> & { path: string; action: SpaceAction })[] =
  [
    {
      path: "",
      label: "Inicio",
      icon: "home",
      group: "principal",
      action: "consultar_espacio",
      exact: true,
    },
    {
      path: "/routes",
      label: "Rutas",
      icon: "route",
      group: "principal",
      action: "consultar_rutas",
    },
    {
      path: "/assistant",
      label: "Asistente",
      icon: "assistant",
      group: "principal",
      action: "consultar_fuentes",
    },
    {
      path: "/sources",
      label: "Fuentes",
      icon: "sources",
      group: "principal",
      action: "consultar_fuentes",
    },
    {
      path: "/members",
      label: "Miembros",
      icon: "members",
      group: "administracion",
      action: "gestionar_miembros",
    },
    {
      path: "/invitations",
      label: "Invitaciones",
      icon: "invitations",
      group: "administracion",
      action: "gestionar_invitaciones",
    },
    {
      path: "/settings",
      label: "Configuración",
      icon: "settings",
      group: "cuenta",
      action: "abandonar_espacio",
    },
  ];

/**
 * Frame shared by every page of a space. It only decides what to show in
 * the navigation; each page keeps its own authorization. Without a session
 * or membership the page is rendered alone, so it can redirect or 404.
 */
export default async function SpaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ spaceId: string }>;
}) {
  const parsed = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsed.success) return children;
  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) return children;
  const repository = new PostgresAccessRepository(getApplicationDatabase());
  const space = await authorizeSpaceAction(
    repository,
    identity.id,
    parsed.data,
    "consultar_espacio",
  );
  if (!space) return children;
  const spaces = await listAuthorizedSpaces(repository, identity.id);
  const base = `/spaces/${space.id}`;

  return (
    <SpaceShell
      email={identity.email ?? null}
      nav={items
        .filter((item) => allowsSpaceAction("activa", space.role, item.action))
        .map((item) => ({
          label: item.label,
          icon: item.icon,
          group: item.group,
          exact: item.exact,
          href: `${base}${item.path}`,
        }))}
      space={{ id: space.id, name: space.name, role: space.role }}
      spaces={spaces.map((item) => ({
        id: item.id,
        name: item.name,
        role: item.role,
      }))}
    >
      {children}
    </SpaceShell>
  );
}
