import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { authorizeSpaceAction } from "@/modules/access/authorization";
import { spaceIdSchema } from "@/modules/access/input";
import { readUsageSummary } from "@/modules/usage/service";
import { PostgresUsageRepository } from "@/adapters/postgres/usage-repository";
import { parseUsageLimits } from "@/lib/ai-budget-config";
import { parseJobNamespace } from "@/lib/job-namespace";

import { leaveSpaceAction } from "./actions";

const usd = (microUsd: number) =>
  `${(microUsd / 1_000_000).toLocaleString("es", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })} USD`;
const formatDay = (value: Date) =>
  new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value) + " UTC";

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

  const database = getApplicationDatabase();
  const repository = new PostgresAccessRepository(database);
  const space = await authorizeSpaceAction(
    repository,
    currentIdentity.id,
    parsedSpaceId.data,
    "consultar_espacio",
  );

  if (!space) {
    notFound();
  }

  const usage = await readUsageSummary(
    {
      accessRepository: repository,
      usageRepository: new PostgresUsageRepository(database),
    },
    {
      identityId: currentIdentity.id,
      spaceId: space.id,
      namespace: parseJobNamespace(process.env),
      limits: parseUsageLimits(process.env),
    },
  );
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
      {usage ? (
        <p className="muted" data-testid="ai-usage">
          Consumo de IA registrado desde {formatDay(usage.since)} (estimación de
          Stepable; no es la factura ni el saldo de OpenAI): hoy en este espacio{" "}
          {usd(usage.spaceTodayMicroUsd)} de {usd(usage.spaceDailyMicroUsd)} (se
          restablece a las 00:00 UTC).{" "}
          {usage.globalExhausted
            ? "El presupuesto total de IA del prototipo está agotado: el operador debe ampliarlo."
            : "El presupuesto total de IA del prototipo está disponible."}
        </p>
      ) : null}
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
