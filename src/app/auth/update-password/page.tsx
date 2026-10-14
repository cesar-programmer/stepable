import { redirect } from "next/navigation";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { AuthLayout, AuthMessage } from "@/app/components/auth-layout";
import { PasswordInput } from "@/app/components/password-input";
import { SubmitButton } from "@/app/components/submit-button";
import { safeInternalPath } from "@/modules/identity/input";

import { updatePasswordAction } from "../actions";

type UpdatePasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const identity = await createSupabaseIdentityGateway();
  if (!(await identity.currentIdentity())) {
    redirect("/login?error=invalid-link");
  }

  const parameters = await searchParams;
  const next = safeInternalPath(
    typeof parameters.next === "string" ? parameters.next : null,
  );

  return (
    <AuthLayout
      description="Después de guardarla tendrás que iniciar sesión de nuevo."
      title="Elige una contraseña nueva"
    >
      {parameters.error ? (
        <AuthMessage tone="error">
          No se pudo guardar la contraseña. Comprueba que ambas coincidan y
          tengan al menos 8 caracteres.
        </AuthMessage>
      ) : null}
      <form action={updatePasswordAction} className="auth-form">
        <input name="next" type="hidden" value={next} />
        <div className="field">
          <label htmlFor="password">Nueva contraseña</label>
          <PasswordInput
            aria-describedby="password-help"
            autoComplete="new-password"
            autoFocus
            id="password"
            minLength={8}
            name="password"
            required
          />
          <p className="field-help" id="password-help">
            Al menos 8 caracteres.
          </p>
        </div>
        <div className="field">
          <label htmlFor="confirmation">Confirmar contraseña</label>
          <PasswordInput
            autoComplete="new-password"
            id="confirmation"
            minLength={8}
            name="confirmation"
            required
          />
        </div>
        <SubmitButton className="auth-submit" pendingLabel="Guardando…">
          Guardar contraseña
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
