import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { authorizeSpaceAction } from "@/modules/access/authorization";
import { spaceIdSchema } from "@/modules/access/input";

import { leaveSpaceAction } from "./actions";

type SpacePageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const messages: Record<string, string> = {
  "role-updated": "Tu rol ahora es integrante.",
  "last-responsible":
    "No puedes salir ni degradarte si eres el último responsable activo.",
};

export default async function SpacePage({
  params,
  searchParams,
}: SpacePageProps) {
  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();

  if (!currentIdentity) {
    redirect("/login?next=/spaces");
  }

  const parsedSpaceId = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsedSpaceId.success) {
    notFound();
  }

  const repository = new PostgresAccessRepository(getApplicationDatabase());
  const space = await authorizeSpaceAction(
    repository,
    currentIdentity.id,
    parsedSpaceId.data,
    "consultar_espacio",
  );

  if (!space) {
    notFound();
  }

  const parameters = await searchParams;
  const notice = typeof parameters.notice === "string" ? parameters.notice : "";
  const error = typeof parameters.error === "string" ? parameters.error : "";

  return (
    <main>
      <p className="eyebrow">Espacio autorizado</p>
      <h1>{space.name}</h1>
      {notice && messages[notice] ? (
        <p className="notice">{messages[notice]}</p>
      ) : null}
      {error && messages[error] ? (
        <p className="error" role="alert">
          {messages[error]}
        </p>
      ) : null}
      <dl className="space-details">
        <div>
          <dt>Clave</dt>
          <dd>{space.slug}</dd>
        </div>
        <div>
          <dt>Tu rol</dt>
          <dd>{space.role}</dd>
        </div>
      </dl>
      <div className="actions">
        {space.role === "responsable" ? (
          <>
            <Link className="button" href={`/spaces/${space.id}/members`}>
              Gestionar miembros
            </Link>
            <Link className="button" href={`/spaces/${space.id}/invitations`}>
              Gestionar invitaciones
            </Link>
          </>
        ) : null}
        <Link className="button" href={`/spaces/${space.id}/sources`}>
          Fuentes
        </Link>
        <Link className="button" href={`/spaces/${space.id}/assistant`}>
          Asistente
        </Link>
        <Link className="button" href={`/spaces/${space.id}/routes`}>
          Rutas
        </Link>
        <Link className="button secondary" href="/spaces">
          Volver a tus espacios
        </Link>
        <form action={leaveSpaceAction} className="inline-form">
          <input name="spaceId" type="hidden" value={space.id} />
          <ConfirmSubmitButton
            className="danger"
            message="¿Confirmas abandonar este espacio? Perderás el acceso hasta recibir y aceptar una nueva invitación."
          >
            Abandonar espacio
          </ConfirmSubmitButton>
        </form>
      </div>
    </main>
  );
}
