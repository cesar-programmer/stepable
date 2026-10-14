import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { AutoRefresh } from "@/app/components/auto-refresh";
import { Icon } from "@/app/components/icons";
import {
  AnimatedItem,
  AnimatedList,
  LinkPending,
} from "@/app/components/motion";
import { spaceIdSchema } from "@/modules/access/input";
import type { RouteSummary } from "@/modules/routes/contract";
import { listSpaceRoutes } from "@/modules/routes/service";

import { DeleteDraftForm } from "./delete-draft-form";
import {
  routeErrorMessages,
  routeNoticeMessages,
  routeState,
} from "./messages";

type RoutesPageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const filters = [
  { key: "todas", label: "Todas" },
  { key: "publicadas", label: "Publicadas" },
  { key: "borradores", label: "Borradores" },
] as const;

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(value);

function primaryAction(route: RouteSummary, canManage: boolean) {
  if (route.status === "publicada") {
    return canManage
      ? { label: "Ver ruta", suffix: "" }
      : { label: "Recorrer", suffix: "/learn" };
  }
  switch (route.generationStatus) {
    case "lista":
      return { label: "Revisar borrador", suffix: "" };
    case "en_cola":
    case "generando":
      return { label: "Ver estado", suffix: "" };
    default:
      return { label: "Resolver", suffix: "" };
  }
}

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

  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  const notice = typeof query.notice === "string" ? query.notice : "";
  const filter = listing.canManage
    ? (filters.find((item) => item.key === query.filtro)?.key ?? "todas")
    : "publicadas";
  const counts = {
    todas: listing.routes.length,
    publicadas: listing.routes.filter((route) => route.status === "publicada")
      .length,
    borradores: listing.routes.filter((route) => route.status === "borrador")
      .length,
  };
  const routes = listing.routes.filter((route) =>
    filter === "publicadas"
      ? route.status === "publicada"
      : filter === "borradores"
        ? route.status === "borrador"
        : true,
  );
  const generating = listing.routes.some((route) =>
    ["en_cola", "generando"].includes(route.generationStatus),
  );
  const base = `/spaces/${spaceId}/routes`;

  return (
    <main>
      <AutoRefresh active={listing.canManage && generating} />
      <div className="page-header">
        <div>
          <h1>Rutas</h1>
          <p className="muted">
            {listing.canManage
              ? "Recorridos de onboarding basados en las fuentes del espacio. Los borradores solo los ves tú hasta publicarlos."
              : "Recorridos de onboarding publicados por las personas responsables."}
          </p>
        </div>
        {listing.canManage ? (
          <Link className="button" href={`${base}/new`}>
            <Icon name="plus" size={18} />
            Crear ruta
          </Link>
        ) : null}
      </div>

      {notice === "draft_deleted" ? (
        <p className="notice" role="status">
          <Icon name="check" size={18} />
          {routeNoticeMessages[notice]}
        </p>
      ) : null}
      {error && routeErrorMessages[error] ? (
        <p className="error" role="alert">
          {routeErrorMessages[error]}
        </p>
      ) : null}

      {listing.canManage && listing.routes.length > 0 ? (
        <nav aria-label="Filtrar rutas" className="tabs">
          {filters.map((item) => (
            <Link
              aria-current={filter === item.key ? "page" : undefined}
              className="tab"
              href={item.key === "todas" ? base : `${base}?filtro=${item.key}`}
              key={item.key}
            >
              {item.label}
              <span className="tab-count">{counts[item.key]}</span>
              <LinkPending />
            </Link>
          ))}
        </nav>
      ) : null}

      {listing.routes.length === 0 ? (
        <div className="empty-state">
          <Icon name="route" size={28} />
          {listing.canManage ? (
            <>
              <h3>Todavía no hay rutas</h3>
              <p>
                Crea la primera: describe qué debe aprender una persona nueva,
                elige las fuentes y revisa el borrador antes de publicarlo.
              </p>
              <Link className="button" href={`${base}/new`}>
                <Icon name="plus" size={18} />
                Crear ruta
              </Link>
            </>
          ) : (
            <>
              <h3>Aún no hay rutas publicadas</h3>
              <p>
                Cuando una persona responsable publique una, aparecerá aquí.
              </p>
            </>
          )}
        </div>
      ) : routes.length === 0 ? (
        <div className="empty-state">
          <p>No hay rutas en este filtro.</p>
        </div>
      ) : (
        <AnimatedList className="route-rows">
          {routes.map((route) => {
            const state = routeState(route);
            const action = primaryAction(route, listing.canManage);
            return (
              <AnimatedItem className="route-row" key={route.id}>
                <div className="route-row-main">
                  <span className={`badge ${state.tone}`}>{state.label}</span>
                  <Link
                    className="route-row-title"
                    href={`${base}/${route.id}${action.suffix}`}
                  >
                    {route.title ?? route.objective}
                  </Link>
                  {route.title ? (
                    <span className="route-row-objective">
                      {route.objective}
                    </span>
                  ) : null}
                </div>
                <div className="route-row-meta">
                  {route.needsReview ? (
                    <span className="badge warning">
                      <Icon name="alert" size={14} />
                      Fuentes cambiadas
                    </span>
                  ) : null}
                  <span className="muted">
                    Actualizada {formatDate(route.updatedAt)}
                  </span>
                  <Link
                    className="button secondary small"
                    href={`${base}/${route.id}${action.suffix}`}
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    {action.label}
                  </Link>
                  {listing.canManage && route.status === "borrador" ? (
                    <DeleteDraftForm
                      from="rutas"
                      generating={route.generationStatus === "generando"}
                      routeId={route.id}
                      spaceId={spaceId}
                      title={route.title ?? route.objective}
                    />
                  ) : null}
                </div>
              </AnimatedItem>
            );
          })}
        </AnimatedList>
      )}
    </main>
  );
}
