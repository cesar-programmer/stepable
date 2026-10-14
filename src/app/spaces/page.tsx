import Link from "next/link";
import { redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { AppHeader } from "@/app/components/app-header";
import { Icon } from "@/app/components/icons";
import { listAuthorizedSpaces } from "@/modules/access/authorization";

type SpacesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const roleLabels = {
  responsable: "Responsable",
  integrante: "Integrante",
} as const;

export default async function SpacesPage({ searchParams }: SpacesPageProps) {
  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();

  if (!currentIdentity) {
    redirect("/login?next=/spaces");
  }

  const repository = new PostgresAccessRepository(getApplicationDatabase());
  const spaces = await listAuthorizedSpaces(repository, currentIdentity.id);
  const parameters = await searchParams;
  const notice = typeof parameters.notice === "string" ? parameters.notice : "";

  return (
    <>
      <AppHeader email={currentIdentity.email} />
      <div className="app-content">
        <main>
          <div className="page-header">
            <div>
              <p className="eyebrow">Elige un espacio para continuar</p>
              <h1>Tus espacios</h1>
              <p className="muted">
                Cada espacio reúne las fuentes, rutas y personas de un equipo o
                proyecto.
              </p>
            </div>
          </div>
          {notice === "left-space" ? (
            <p className="notice" role="status">
              <Icon name="check" size={18} />
              Ya no tienes acceso a ese espacio.
            </p>
          ) : null}
          {spaces.length === 0 ? (
            <div className="empty-state">
              <Icon name="home" size={28} />
              <h3>Todavía no perteneces a ningún espacio.</h3>
              <p>
                Cuando una persona responsable te invite, el espacio aparecerá
                aquí. Revisa el correo de invitación para aceptarla.
              </p>
            </div>
          ) : (
            <ul className="grid space-grid">
              {spaces.map((space) => (
                <li key={space.id}>
                  <Link
                    className="card card-link space-card"
                    href={`/spaces/${space.id}`}
                  >
                    <span className="avatar large" aria-hidden="true">
                      {space.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="space-card-text">
                      <span className="space-card-name">{space.name}</span>
                      <span className="muted">{roleLabels[space.role]}</span>
                    </span>
                    <Icon name="chevronRight" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </>
  );
}
