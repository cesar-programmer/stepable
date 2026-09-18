import Link from "next/link";

import { requestPasswordRecoveryAction } from "../auth/actions";

type RecoverPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RecoverPage({ searchParams }: RecoverPageProps) {
  const parameters = await searchParams;

  return (
    <main>
      <p className="eyebrow">Identidad local</p>
      <h1>Recuperar contraseña</h1>
      <p>El mensaje se captura en Mailpit y no se envía a Internet.</p>

      {parameters.notice === "requested" ? (
        <p className="notice">
          Si el correo corresponde a un usuario local, encontrarás un enlace en
          Mailpit.
        </p>
      ) : null}

      <form action={requestPasswordRecoveryAction}>
        <label>
          Correo
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <button type="submit">Enviar enlace local</button>
      </form>

      <p className="muted">
        <Link href="/login">Volver al inicio de sesión</Link>
      </p>
    </main>
  );
}
