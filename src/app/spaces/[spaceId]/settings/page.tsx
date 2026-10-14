import { notFound, redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { Icon } from "@/app/components/icons";
import { authorizeSpaceAction } from "@/modules/access/authorization";
import { spaceIdSchema } from "@/modules/access/input";

import { leaveSpaceAction } from "../actions";

const roleLabels = {
  responsable: "Responsable",
  integrante: "Integrante",
} as const;

const errors: Record<string, string> = {
  "last-responsible":
    "No puedes salir ni degradarte si eres el último responsable activo.",
};

export default async function SpaceSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsed.success) notFound();
  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${parsed.data}/settings`)}`,
    );
  }
  const space = await authorizeSpaceAction(
    new PostgresAccessRepository(getApplicationDatabase()),
    identity.id,
    parsed.data,
    "abandonar_espacio",
  );
  if (!space) notFound();
  const error = (await searchParams).error;

  return (
    <main>
      <div className="page-header">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Tu participación</h1>
          <p className="muted">Datos de tu membresía en {space.name}.</p>
        </div>
      </div>
      {typeof error === "string" && errors[error] ? (
        <p className="error" role="alert">
          <Icon name="alert" size={18} />
          {errors[error]}
        </p>
      ) : null}

      <section className="card">
        <dl className="space-details">
          <div>
            <dt>Espacio</dt>
            <dd>{space.name}</dd>
          </div>
          <div>
            <dt>Clave</dt>
            <dd>{space.slug}</dd>
          </div>
          <div>
            <dt>Tu rol</dt>
            <dd>{roleLabels[space.role]}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="zona-salida"
        className="section card danger-card"
      >
        <h2 id="zona-salida">Abandonar el espacio</h2>
        <p className="muted">
          Perderás el acceso a sus rutas, fuentes y asistente hasta recibir y
          aceptar una nueva invitación. Tu progreso se conserva.
        </p>
        <form action={leaveSpaceAction} className="inline-form">
          <input name="spaceId" type="hidden" value={space.id} />
          <ConfirmSubmitButton
            className="danger"
            confirmLabel="Abandonar espacio"
            message="¿Confirmas abandonar este espacio? Perderás el acceso hasta recibir y aceptar una nueva invitación."
          >
            Abandonar espacio
          </ConfirmSubmitButton>
        </form>
      </section>
    </main>
  );
}
