import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { PostgresSourceRepository } from "@/adapters/postgres/source-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { AutoRefresh } from "@/app/components/auto-refresh";
import { spaceIdSchema } from "@/modules/access/input";
import { requestedActivityTypes, routeLimits } from "@/modules/routes/contract";
import { listSpaceRoutes } from "@/modules/routes/service";

import { createRouteAction } from "./actions";
import {
  requestedActivityLabels,
  routeErrorMessages,
  routeGenerationLabels,
} from "./messages";

type RoutesPageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RoutesPage({
  params,
  searchParams,
}: RoutesPageProps) {
  const parsedSpaceId = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsedSpaceId.success) notFound();
  const spaceId = parsedSpaceId.data;

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect(`/login?next=${encodeURIComponent(`/spaces/${spaceId}/routes`)}`);
  }

  const database = getApplicationDatabase();
  const listing = await listSpaceRoutes(
    {
      accessRepository: new PostgresAccessRepository(database),
      routeRepository: new PostgresRouteRepository(database, null),
    },
    { identityId: currentIdentity.id, spaceId },
  );
  if (!listing) notFound();
  const readySources = listing.canManage
    ? await new PostgresSourceRepository(database, null).listSources(
        spaceId,
        true,
      )
    : [];

  const error = (await searchParams).error;
  const generating = listing.routes.some((route) =>
    ["en_cola", "generando"].includes(route.generationStatus),
  );

  return (
    <main className="wide">
      <AutoRefresh active={generating} />
      <p className="eyebrow">Onboarding</p>
      <h1>Rutas</h1>
      {typeof error === "string" && routeErrorMessages[error] ? (
        <p className="error" role="alert">
          {routeErrorMessages[error]}
        </p>
      ) : null}

      {listing.canManage ? (
        <form action={createRouteAction} className="route-request">
          <input name="spaceId" type="hidden" value={spaceId} />
          <label>
            Objetivo de aprendizaje
            <textarea
              maxLength={routeLimits.objectiveMaxChars}
              minLength={routeLimits.objectiveMinChars}
              name="objective"
              required
              rows={3}
            />
          </label>
          <fieldset>
            <legend>
              Fuentes (hasta {routeLimits.maxSources}; solo fuentes listas)
            </legend>
            {readySources.length === 0 ? (
              <p className="muted">No hay fuentes listas en el espacio.</p>
            ) : (
              readySources.map((source) => (
                <label className="checkbox" key={source.id}>
                  <input name="sourceIds" type="checkbox" value={source.id} />
                  {source.title} · versión {source.versionNumber}
                </label>
              ))
            )}
          </fieldset>
          <fieldset>
            <legend>Tipos de actividad (al menos un paso de cada uno)</legend>
            {requestedActivityTypes.map((type) => (
              <label className="checkbox" key={type}>
                <input
                  defaultChecked={type === "opcion_multiple"}
                  name="activityTypes"
                  type="checkbox"
                  value={type}
                />
                {requestedActivityLabels[type]}
              </label>
            ))}
            <p className="muted">
              Lectura de código y completar código necesitan código en las
              fuentes seleccionadas. Si no hay evidencia para algún tipo, el
              borrador queda como insuficiente; no se sustituye por otro tipo.
            </p>
          </fieldset>
          <p className="muted">
            Cada generación hace una llamada al modelo configurado y cuenta en
            el máximo de {routeLimits.dailyGenerationAttempts} intentos por
            espacio y día (UTC). El borrador no se publica hasta que lo revises.
          </p>
          <button disabled={readySources.length === 0} type="submit">
            Generar borrador
          </button>
        </form>
      ) : (
        <p className="muted">Se muestran las rutas publicadas.</p>
      )}

      {listing.routes.length === 0 ? (
        <p className="empty-state">Todavía no hay rutas.</p>
      ) : (
        <ul className="source-list">
          {listing.routes.map((route) => (
            <li key={route.id}>
              <div>
                <Link href={`/spaces/${spaceId}/routes/${route.id}`}>
                  {route.title ?? route.objective.slice(0, 80)}
                </Link>
                <span className="muted">
                  {route.status === "publicada"
                    ? "Publicada"
                    : `Borrador · ${routeGenerationLabels[route.generationStatus]}`}
                </span>
              </div>
              {route.needsReview ? (
                <span className="status fallida">
                  Revisar: fuentes cambiaron
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <Link className="button secondary" href={`/spaces/${spaceId}`}>
          Volver al espacio
        </Link>
      </div>
    </main>
  );
}
