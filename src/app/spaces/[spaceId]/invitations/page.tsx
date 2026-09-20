import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresInvitationRepository } from "@/adapters/postgres/invitation-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { spaceIdSchema } from "@/modules/access/input";
import { listSpaceInvitations } from "@/modules/invitations/service";

import {
  cancelInvitationAction,
  createInvitationAction,
  resendInvitationAction,
} from "./actions";

type InvitationsPageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const messages: Record<string, string> = {
  sent: "Invitación enviada a Mailpit.",
  cancelled: "Invitación cancelada.",
  already_cancelled: "La invitación ya estaba cancelada.",
  delivery_failed:
    "La invitación quedó registrada, pero el correo no se entregó. Usa Reenviar para recuperarla.",
  state_changed: "La invitación cambió mientras se enviaba. Revisa su estado.",
  pending_exists: "Ya existe una invitación pendiente o vencida. Usa Reenviar.",
  already_member: "La persona ya pertenece al espacio con ese rol.",
  member_role_conflict:
    "La persona ya pertenece al espacio con un rol distinto.",
  not_found: "La invitación no existe en este espacio.",
  not_resendable: "Esta invitación ya no se puede reenviar.",
  not_cancellable: "Esta invitación ya fue aceptada.",
  unauthorized: "No tienes permiso para gestionar invitaciones.",
};

export default async function InvitationsPage({
  params,
  searchParams,
}: InvitationsPageProps) {
  const parsedSpaceId = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsedSpaceId.success) notFound();

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${parsedSpaceId.data}/invitations`)}`,
    );
  }

  const database = getApplicationDatabase();
  const invitations = await listSpaceInvitations(
    {
      accessRepository: new PostgresAccessRepository(database),
      invitationRepository: new PostgresInvitationRepository(database),
    },
    { identityId: currentIdentity.id, spaceId: parsedSpaceId.data },
  );
  if (!invitations) notFound();

  const parameters = await searchParams;
  const notice = typeof parameters.notice === "string" ? parameters.notice : "";
  const error = typeof parameters.error === "string" ? parameters.error : "";

  return (
    <main>
      <p className="eyebrow">Acceso al espacio</p>
      <h1>Invitaciones</h1>
      <p>Cada enlace dura siete días y solo puede aceptarse una vez.</p>
      {notice && messages[notice] ? (
        <p className="notice">{messages[notice]}</p>
      ) : null}
      {error && messages[error] ? (
        <p className="error" role="alert">
          {messages[error]}
        </p>
      ) : null}

      <form action={createInvitationAction}>
        <input name="spaceId" type="hidden" value={parsedSpaceId.data} />
        <label>
          Correo
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <label>
          Rol
          <select defaultValue="integrante" name="role">
            <option value="integrante">Integrante</option>
            <option value="responsable">Responsable</option>
          </select>
        </label>
        <button type="submit">Enviar invitación</button>
      </form>

      {invitations.length === 0 ? (
        <p className="empty-state">Aún no hay invitaciones.</p>
      ) : (
        <ul className="invitation-list">
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              <div>
                <strong>{invitation.email}</strong>
                <span>
                  {invitation.role} · {invitation.status} · correo{" "}
                  {invitation.deliveryStatus}
                </span>
              </div>
              {(invitation.status === "pendiente" ||
                invitation.status === "vencida") && (
                <div className="actions compact">
                  <form action={resendInvitationAction} className="inline-form">
                    <input
                      name="spaceId"
                      type="hidden"
                      value={parsedSpaceId.data}
                    />
                    <input
                      name="invitationId"
                      type="hidden"
                      value={invitation.id}
                    />
                    <button type="submit">Reenviar</button>
                  </form>
                  <form action={cancelInvitationAction} className="inline-form">
                    <input
                      name="spaceId"
                      type="hidden"
                      value={parsedSpaceId.data}
                    />
                    <input
                      name="invitationId"
                      type="hidden"
                      value={invitation.id}
                    />
                    <button className="secondary" type="submit">
                      Cancelar
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <Link
          className="button secondary"
          href={`/spaces/${parsedSpaceId.data}`}
        >
          Volver al espacio
        </Link>
      </div>
    </main>
  );
}
