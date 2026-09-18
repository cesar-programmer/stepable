import Link from "next/link";
import { redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";

import { logoutAction } from "../auth/actions";

export default async function SpacesPage() {
  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();

  if (!currentIdentity) {
    redirect("/login?next=/spaces");
  }

  const repository = new PostgresAccessRepository(getApplicationDatabase());
  const spaces = await repository.listSpacesForIdentity(currentIdentity.id);

  return (
    <main>
      <p className="eyebrow">Acceso local E1.3</p>
      <h1>Tus espacios</h1>
      {spaces.length === 0 ? (
        <p className="empty-state">Todavía no perteneces a ningún espacio.</p>
      ) : (
        <ul className="space-list">
          {spaces.map((space) => (
            <li key={space.id}>
              <Link href={`/spaces/${space.id}`}>{space.name}</Link>
              <span>{space.role}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        <Link className="button secondary" href="/protected">
          Volver a la sesión
        </Link>
        <form action={logoutAction} className="inline-form">
          <button type="submit">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
