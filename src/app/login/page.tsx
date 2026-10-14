import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { AuthLayout, AuthMessage } from "@/app/components/auth-layout";
import { PasswordInput } from "@/app/components/password-input";
import { SubmitButton } from "@/app/components/submit-button";
import { safeInternalPath } from "@/modules/identity/input";

import { loginAction } from "../auth/actions";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const parameters = await searchParams;
  const next = safeInternalPath(
    typeof parameters.next === "string" ? parameters.next : null,
  );
  const identity = await createSupabaseIdentityGateway();

  if (await identity.currentIdentity()) {
    redirect(next);
  }

  return (
    <AuthLayout
      description="Entra para continuar con las rutas y las fuentes de tu equipo."
      footer={
        <p className="muted">
          ¿No tienes cuenta? El acceso es por invitación de una persona
          responsable de tu equipo.
        </p>
      }
      title="Inicia sesión"
    >
      {parameters.error === "invalid" ? (
        <AuthMessage tone="error">
          Correo o contraseña incorrectos. Revisa los datos e inténtalo de
          nuevo.
        </AuthMessage>
      ) : null}
      {parameters.error === "invalid-link" ? (
        <AuthMessage tone="error">
          El enlace no es válido o ya fue utilizado. Pide uno nuevo desde
          «¿Olvidaste tu contraseña?».
        </AuthMessage>
      ) : null}
      {parameters.notice === "signed-out" ? (
        <AuthMessage tone="notice">Cerraste la sesión.</AuthMessage>
      ) : null}
      {parameters.notice === "password-updated" ? (
        <AuthMessage tone="notice">
          Tu contraseña se actualizó. Inicia sesión con la nueva.
        </AuthMessage>
      ) : null}

      <form action={loginAction} className="auth-form">
        <input name="next" type="hidden" value={next} />
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input
            autoComplete="email"
            autoFocus
            id="email"
            name="email"
            required
            type="email"
          />
        </div>
        <div className="field">
          <div className="field-label-row">
            <label htmlFor="password">Contraseña</label>
            <Link className="field-link" href="/recover">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <PasswordInput
            autoComplete="current-password"
            id="password"
            name="password"
            required
          />
        </div>
        <SubmitButton className="auth-submit" pendingLabel="Entrando…">
          Entrar
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
