import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
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
    <main>
      <p className="eyebrow">Identidad local</p>
      <h1>Iniciar sesión</h1>
      <p>Usa un usuario creado mediante el procedimiento local.</p>

      {parameters.error === "invalid" ? (
        <p className="error" role="alert">
          Correo o contraseña incorrectos.
        </p>
      ) : null}
      {parameters.error === "invalid-link" ? (
        <p className="error" role="alert">
          El enlace no es válido o ya fue utilizado.
        </p>
      ) : null}
      {parameters.notice === "signed-out" ? (
        <p className="notice">La sesión se cerró correctamente.</p>
      ) : null}
      {parameters.notice === "password-updated" ? (
        <p className="notice">
          La contraseña se actualizó. Inicia sesión nuevamente.
        </p>
      ) : null}

      <form action={loginAction}>
        <input name="next" type="hidden" value={next} />
        <label>
          Correo
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <label>
          Contraseña
          <input
            autoComplete="current-password"
            name="password"
            required
            type="password"
          />
        </label>
        <button type="submit">Entrar</button>
      </form>

      <p className="muted">
        <Link href="/recover">¿Olvidaste tu contraseña?</Link>
      </p>
    </main>
  );
}
