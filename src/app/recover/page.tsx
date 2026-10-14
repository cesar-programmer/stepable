import Link from "next/link";

import { AuthLayout, AuthMessage } from "@/app/components/auth-layout";
import { Icon } from "@/app/components/icons";
import { SubmitButton } from "@/app/components/submit-button";

import { requestPasswordRecoveryAction } from "../auth/actions";

type RecoverPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RecoverPage({ searchParams }: RecoverPageProps) {
  const parameters = await searchParams;

  return (
    <AuthLayout
      description="Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva."
      footer={
        <Link className="back-link" href="/login">
          <Icon className="flip" name="chevronRight" size={16} />
          Volver a iniciar sesión
        </Link>
      }
      title="Recupera tu contraseña"
    >
      {parameters.notice === "requested" ? (
        <AuthMessage tone="notice">
          Si el correo corresponde a una cuenta, recibirás un enlace en unos
          minutos. En este entorno local, encontrarás un enlace en Mailpit.
        </AuthMessage>
      ) : null}

      <form action={requestPasswordRecoveryAction} className="auth-form">
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
        <SubmitButton className="auth-submit" pendingLabel="Enviando…">
          Enviar enlace
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
