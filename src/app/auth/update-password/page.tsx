import { redirect } from "next/navigation";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";

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

  return (
    <main>
      <p className="eyebrow">Identidad local</p>
      <h1>Establecer contraseña</h1>
      {parameters.error ? (
        <p className="error" role="alert">
          No fue posible actualizar la contraseña. Revisa que coincidan y tengan
          al menos ocho caracteres.
        </p>
      ) : null}
      <form action={updatePasswordAction}>
        <label>
          Nueva contraseña
          <input
            autoComplete="new-password"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>
        <label>
          Confirmar contraseña
          <input
            autoComplete="new-password"
            minLength={8}
            name="confirmation"
            required
            type="password"
          />
        </label>
        <button type="submit">Guardar contraseña</button>
      </form>
    </main>
  );
}
