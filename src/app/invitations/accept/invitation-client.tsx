"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  acceptInvitationAction,
  inspectInvitationAction,
  requestInvitedAccountAction,
} from "./actions";

type Preview = Awaited<ReturnType<typeof inspectInvitationAction>>;

const tokenStorageKey = "stepable.pendingInvitationToken";

export function InvitationClient({
  authenticatedEmail,
}: {
  authenticatedEmail: string | null;
}) {
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const fragmentToken = new URLSearchParams(
      window.location.hash.slice(1),
    ).get("token");
    const candidate =
      fragmentToken ?? sessionStorage.getItem(tokenStorageKey) ?? "";
    if (fragmentToken) {
      sessionStorage.setItem(tokenStorageKey, fragmentToken);
      history.replaceState(null, "", window.location.pathname);
    }
    if (!candidate) {
      Promise.resolve().then(() => {
        setToken("");
        setPreview({ kind: "invalid" });
      });
      return;
    }
    void inspectInvitationAction(candidate).then((result) => {
      setToken(candidate);
      setPreview(result);
    });
  }, []);

  function requestAccount() {
    startTransition(async () => {
      const result = await requestInvitedAccountAction(token);
      if (result === "requested") {
        setMessage(
          "Revisa Mailpit si necesitas configurar una cuenta nueva. Si ya tienes cuenta, inicia sesión. Después vuelve a esta pestaña para aceptar.",
        );
      } else if (result === "delivery_failed") {
        setMessage(
          "No se pudo enviar el correo de configuración. Puedes reintentarlo.",
        );
      } else {
        setMessage("La invitación ya no está disponible.");
      }
    });
  }

  function accept() {
    startTransition(async () => {
      const result = await acceptInvitationAction(token);
      if (
        result.kind === "joined" ||
        result.kind === "reactivated" ||
        result.kind === "already_member" ||
        result.kind === "already_accepted"
      ) {
        sessionStorage.removeItem(tokenStorageKey);
        router.push(`/spaces/${result.spaceId}`);
        return;
      }
      const messages: Record<string, string> = {
        authentication_required: "Inicia sesión para aceptar la invitación.",
        email_mismatch:
          "La sesión no corresponde al correo verificado de la invitación.",
        expired: "La invitación venció. Solicita un reenvío.",
        cancelled: "La invitación fue cancelada.",
        member_role_conflict:
          "Ya perteneces al espacio con un rol distinto; la invitación no cambió tu rol.",
        invalid: "El enlace no es válido o fue reemplazado.",
      };
      setMessage(
        messages[result.kind] ?? "No fue posible aceptar la invitación.",
      );
      setPreview(await inspectInvitationAction(token));
    });
  }

  if (preview === null || (pending && !preview)) {
    return <p>Revisando invitación…</p>;
  }
  if (preview.kind === "invalid") {
    return <p className="error">El enlace no es válido o fue reemplazado.</p>;
  }

  const available = preview.preview.status === "pendiente";
  return (
    <>
      <dl className="space-details">
        <div>
          <dt>Espacio</dt>
          <dd>{preview.preview.spaceName}</dd>
        </div>
        <div>
          <dt>Rol</dt>
          <dd>{preview.preview.role}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{preview.preview.status}</dd>
        </div>
      </dl>
      {message ? <p className="notice">{message}</p> : null}
      {available ? (
        authenticatedEmail ? (
          <div className="actions">
            <button disabled={pending} onClick={accept} type="button">
              Aceptar invitación
            </button>
            <span className="muted">Sesión: {authenticatedEmail}</span>
          </div>
        ) : (
          <div className="actions">
            <Link className="button" href="/login?next=%2Finvitations%2Faccept">
              Iniciar sesión
            </Link>
            <button
              className="secondary"
              disabled={pending}
              onClick={requestAccount}
              type="button"
            >
              Configurar cuenta nueva
            </button>
          </div>
        )
      ) : (
        <p className="error">Esta invitación ya no está pendiente.</p>
      )}
    </>
  );
}
