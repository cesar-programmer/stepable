import Link from "next/link";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { AuthLayout } from "@/app/components/auth-layout";
import { Icon } from "@/app/components/icons";

export default async function HomePage() {
  const signedIn = Boolean(
    await (await createSupabaseIdentityGateway()).currentIdentity(),
  );
  return (
    <AuthLayout
      description="Convierte la documentación de tu equipo en rutas de aprendizaje revisadas, con preguntas, ejercicios de código y un asistente que responde citando las fuentes."
      title="Stepable"
    >
      <p className="eyebrow">Onboarding y consultas para equipos</p>
      <div className="actions">
        {signedIn ? (
          <Link className="button" href="/spaces">
            Ir a tus espacios
            <Icon name="arrowRight" size={18} />
          </Link>
        ) : (
          <Link className="button" href="/login">
            Iniciar sesión
            <Icon name="arrowRight" size={18} />
          </Link>
        )}
      </div>
    </AuthLayout>
  );
}
