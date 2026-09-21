import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostgresMembershipRepository } from "@/adapters/postgres/membership-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { spaceIdSchema } from "@/modules/access/input";
import { listSpaceMembers } from "@/modules/memberships/service";

import { changeMemberRoleAction, revokeMemberAction } from "./actions";

type MembersPageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const messages: Record<string, string> = {
  updated: "Rol actualizado.",
  unchanged: "La membresía ya tenía ese rol.",
  revoked: "Acceso retirado.",
  unauthorized: "Ya no tienes permiso para gestionar miembros.",
  not_found: "La membresía no existe en este espacio.",
  inactive:
    "Una membresía revocada solo puede reactivarse mediante una nueva invitación.",
  last_responsible: "El espacio debe conservar al menos un responsable activo.",
};

export default async function MembersPage({
  params,
  searchParams,
}: MembersPageProps) {
  const parsedSpaceId = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsedSpaceId.success) notFound();

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${parsedSpaceId.data}/members`)}`,
    );
  }

  const members = await listSpaceMembers(
    new PostgresMembershipRepository(getApplicationDatabase()),
    { identityId: currentIdentity.id, spaceId: parsedSpaceId.data },
  );
  if (!members) notFound();

  const parameters = await searchParams;
  const notice = typeof parameters.notice === "string" ? parameters.notice : "";
  const error = typeof parameters.error === "string" ? parameters.error : "";

  return (
    <main className="wide">
      <p className="eyebrow">Acceso al espacio</p>
      <h1>Miembros</h1>
      <p>
        Las membresías revocadas se conservan y solo una nueva invitación puede
        reactivarlas.
      </p>
      {notice && messages[notice] ? (
        <p className="notice">{messages[notice]}</p>
      ) : null}
      {error && messages[error] ? (
        <p className="error" role="alert">
          {messages[error]}
        </p>
      ) : null}

      <ul className="member-list">
        {members.map((member) => {
          const isSelf = member.profileId === currentIdentity.id;
          return (
            <li key={member.profileId}>
              <div className="member-identity">
                <strong>{member.email ?? "Identidad sin correo"}</strong>
                {isSelf ? <span>(tú)</span> : null}
                <span className={`status ${member.status}`}>
                  {member.status}
                </span>
              </div>
              <div>
                <span className="member-role">{member.role}</span>
                {member.status === "activa" ? (
                  <div className="member-controls">
                    <form
                      action={changeMemberRoleAction}
                      className="inline-form"
                    >
                      <input
                        name="spaceId"
                        type="hidden"
                        value={parsedSpaceId.data}
                      />
                      <input
                        name="targetProfileId"
                        type="hidden"
                        value={member.profileId}
                      />
                      <label>
                        <span className="sr-only">Rol de {member.email}</span>
                        <select defaultValue={member.role} name="role">
                          <option value="integrante">Integrante</option>
                          <option value="responsable">Responsable</option>
                        </select>
                      </label>
                      <ConfirmSubmitButton
                        message={`¿Confirmas cambiar el rol de ${member.email ?? "esta identidad"}?`}
                      >
                        Guardar rol
                      </ConfirmSubmitButton>
                    </form>
                    <form action={revokeMemberAction} className="inline-form">
                      <input
                        name="spaceId"
                        type="hidden"
                        value={parsedSpaceId.data}
                      />
                      <input
                        name="targetProfileId"
                        type="hidden"
                        value={member.profileId}
                      />
                      <ConfirmSubmitButton
                        className="danger"
                        message={`¿Confirmas retirar el acceso de ${member.email ?? "esta identidad"}?`}
                      >
                        Retirar acceso
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                ) : (
                  <span className="muted">
                    Reactivación solo por invitación
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

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
