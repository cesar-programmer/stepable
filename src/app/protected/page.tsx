import { redirect } from "next/navigation";
import Link from "next/link";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";

import { logoutAction } from "../auth/actions";

export default async function ProtectedPage() {
  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();

  if (!currentIdentity) {
    redirect("/login?next=/protected");
  }

  return (
    <main>
      <p className="eyebrow">Página protegida</p>
      <h1>Sesión validada en el servidor</h1>
      <p>
        Identidad: <strong>{currentIdentity.email}</strong>
      </p>
      <p className="muted">
        Esta pantalla confirma identidad. El acceso a espacios se comprueba por
        membresía en cada consulta.
      </p>
      <div className="actions">
        <Link className="button secondary" href="/spaces">
          Ver mis espacios
        </Link>
      </div>
      <form action={logoutAction}>
        <button type="submit">Cerrar sesión</button>
      </form>
    </main>
  );
}
