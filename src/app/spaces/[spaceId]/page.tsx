import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresLearningRepository } from "@/adapters/postgres/learning-repository";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { PostgresSourceRepository } from "@/adapters/postgres/source-repository";
import { PostgresUsageRepository } from "@/adapters/postgres/usage-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { Icon } from "@/app/components/icons";
import { parseUsageLimits } from "@/lib/ai-budget-config";
import { parseJobNamespace } from "@/lib/job-namespace";
import { authorizeSpaceAction } from "@/modules/access/authorization";
import { spaceIdSchema } from "@/modules/access/input";
import type { LearnerView, TeamProgress } from "@/modules/learning/contract";
import { readLearnerView, readTeamProgress } from "@/modules/learning/service";
import type { RouteSummary } from "@/modules/routes/contract";
import { listSpaceRoutes } from "@/modules/routes/service";
import { listSpaceSources } from "@/modules/sources/service";
import { readUsageSummary } from "@/modules/usage/service";

import { DeleteDraftForm } from "./routes/delete-draft-form";
import {
  routeErrorMessages,
  routeGenerationLabels,
  routeNoticeMessages,
} from "./routes/messages";
import { UsagePanel } from "./usage-panel";

type SpacePageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const messages: Record<string, string> = {
  "role-updated": "Tu rol ahora es integrante.",
  "last-responsible":
    "No puedes salir ni degradarte si eres el último responsable activo.",
};

const roleLabels = {
  responsable: "Responsable",
  integrante: "Integrante",
} as const;

function learnerState(view: LearnerView) {
  if (view.completed) return { label: "Completada", tone: "success" };
  if (view.started) return { label: "En progreso", tone: "brand" };
  return { label: "No empezada", tone: "neutral" };
}

function LearnerRouteCard({
  spaceId,
  route,
  view,
}: {
  spaceId: string;
  route: RouteSummary;
  view: LearnerView;
}) {
  const state = learnerState(view);
  const ratio = view.totalSteps > 0 ? view.resolvedSteps / view.totalSteps : 0;
  return (
    <li>
      <Link
        className="card card-link route-card"
        href={`/spaces/${spaceId}/routes/${route.id}/learn`}
      >
        <span className="route-card-footer">
          <span className={`badge ${state.tone}`}>{state.label}</span>
          {route.needsReview ? (
            <span className="badge warning">Revisar fuentes</span>
          ) : null}
        </span>
        <h3>{view.title}</h3>
        <p className="muted">{view.objective}</p>
        <span aria-hidden="true" className="progress">
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
        <span className="meta">
          {view.resolvedSteps} de {view.totalSteps} pasos resueltos ·{" "}
          {view.correctSteps} acertados
        </span>
      </Link>
    </li>
  );
}

function TeamRouteCard({
  spaceId,
  team,
}: {
  spaceId: string;
  team: TeamProgress;
}) {
  const ratio =
    team.activeMembers > 0 ? team.completed / team.activeMembers : 0;
  return (
    <li>
      <Link
        className="card card-link route-card"
        href={`/spaces/${spaceId}/routes/${team.routeId}/progress`}
      >
        <h3>{team.title}</h3>
        <span aria-hidden="true" className="progress">
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
        <span className="meta">
          {team.started} de {team.activeMembers} empezaron · {team.completed}{" "}
          completaron
        </span>
        <span className="meta">
          {team.totalSteps} pasos · ver detalle
          <Icon name="arrowRight" size={16} />
        </span>
      </Link>
    </li>
  );
}

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
  const accessRepository = new PostgresAccessRepository(database);
  const space = await authorizeSpaceAction(
    accessRepository,
    currentIdentity.id,
    parsedSpaceId.data,
    "consultar_espacio",
  );
  if (!space) {
    notFound();
  }

  const routeRepository = new PostgresRouteRepository(database, null);
  const learning = {
    accessRepository,
    routeRepository,
    learningRepository: new PostgresLearningRepository(database),
  };
  const ids = { identityId: currentIdentity.id, spaceId: space.id };
  // Every read below authorizes on its own; only real data is shown.
  const [listing, sources, usage] = await Promise.all([
    listSpaceRoutes({ accessRepository, routeRepository }, ids),
    listSpaceSources(
      {
        accessRepository,
        sourceRepository: new PostgresSourceRepository(database, null),
      },
      ids,
    ),
    readUsageSummary(
      {
        accessRepository,
        usageRepository: new PostgresUsageRepository(database),
      },
      {
        ...ids,
        namespace: parseJobNamespace(process.env),
        limits: parseUsageLimits(process.env),
      },
    ),
  ]);
  const routes = listing?.routes ?? [];
  const published = routes.filter((route) => route.status === "publicada");
  const drafts = routes.filter((route) => route.status === "borrador");
  const canManage = listing?.canManage ?? false;

  // Members see their own progress; responsibles see the team's.
  const learnerViews = (
    canManage
      ? []
      : await Promise.all(
          published.map(async (route) => ({
            route,
            view: await readLearnerView(learning, {
              ...ids,
              routeId: route.id,
            }),
          })),
        )
  ).flatMap((item) =>
    item.view ? [{ route: item.route, view: item.view }] : [],
  );
  const teams = canManage
    ? (
        await Promise.all(
          published.map((route) =>
            readTeamProgress(learning, { ...ids, routeId: route.id }),
          ),
        )
      ).flatMap((team) => (team ? [team] : []))
    : [];
  const readySources =
    sources?.sources.filter((source) => source.status === "lista") ?? [];
  const nextRoute =
    learnerViews.find((item) => item.view.started && !item.view.completed) ??
    learnerViews.find((item) => !item.view.started);

  const parameters = await searchParams;
  const notice = typeof parameters.notice === "string" ? parameters.notice : "";
  const error = typeof parameters.error === "string" ? parameters.error : "";
  const base = `/spaces/${space.id}`;
  // Draft deletion comes back here with the routes' own messages.
  const noticeText =
    messages[notice] ??
    (notice === "draft_deleted" ? routeNoticeMessages[notice] : undefined);
  const errorText =
    messages[error] ??
    (error === "publicada" || error === "generando"
      ? routeErrorMessages[error]
      : undefined);

  return (
    <main>
      <div className="page-header">
        <div>
          <p className="eyebrow">Inicio · {roleLabels[space.role]}</p>
          <h1>{space.name}</h1>
          <p className="muted">
            {canManage
              ? "Prepara el contenido del equipo y sigue su avance."
              : "Sigue tus rutas y consulta al asistente cuando lo necesites."}
          </p>
        </div>
        {usage ? <UsagePanel usage={usage} /> : null}
      </div>

      {noticeText ? (
        <p className="notice" role="status">
          {noticeText}
        </p>
      ) : null}
      {errorText ? (
        <p className="error" role="alert">
          {errorText}
        </p>
      ) : null}

      {canManage ? (
        <>
          <section aria-label="Resumen del contenido" className="stats">
            <div className="stat">
              <span className="stat-value">{readySources.length}</span>
              <span className="stat-label">
                Fuentes listas de {sources?.sources.length ?? 0}
              </span>
            </div>
            <div className="stat">
              <span className="stat-value">{published.length}</span>
              <span className="stat-label">Rutas publicadas</span>
            </div>
            <div className="stat">
              <span className="stat-value">{drafts.length}</span>
              <span className="stat-label">Borradores</span>
            </div>
          </section>

          {readySources.length === 0 ? (
            <div className="empty-state">
              <Icon name="upload" size={28} />
              <h3>Empieza cargando la documentación del equipo</h3>
              <p>
                Las rutas y el asistente se basan en fuentes Markdown o PDF con
                texto. Cuando una fuente esté lista podrás generar una ruta.
              </p>
              <Link className="button" href={`${base}/sources`}>
                <Icon name="plus" size={18} />
                Cargar una fuente
              </Link>
            </div>
          ) : routes.length === 0 ? (
            <div className="empty-state">
              <Icon name="route" size={28} />
              <h3>Genera la primera ruta de onboarding</h3>
              <p>
                Describe qué debe aprender una persona nueva y elige las
                fuentes. Revisarás el borrador antes de publicarlo.
              </p>
              <Link className="button" href={`${base}/routes`}>
                <Icon name="plus" size={18} />
                Crear una ruta
              </Link>
            </div>
          ) : null}

          {teams.length > 0 ? (
            <section className="section">
              <div className="section-header">
                <h2>Progreso del equipo</h2>
                <span className="muted">
                  Miembros activos por ruta publicada
                </span>
              </div>
              <ul className="grid space-grid">
                {teams.map((team) => (
                  <TeamRouteCard
                    key={team.routeId}
                    spaceId={space.id}
                    team={team}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {drafts.length > 0 ? (
            <section className="section">
              <div className="section-header">
                <h2>Borradores</h2>
                <span className="muted">Pendientes de revisar y publicar</span>
              </div>
              <ul className="grid space-grid">
                {drafts.map((route) => (
                  <li className="card route-card draft-card" key={route.id}>
                    <span
                      className={`badge ${
                        route.generationStatus === "lista"
                          ? "brand"
                          : route.generationStatus === "fallida" ||
                              route.generationStatus === "insuficiente"
                            ? "danger"
                            : "info"
                      }`}
                    >
                      {routeGenerationLabels[route.generationStatus]}
                    </span>
                    <h3>
                      <Link
                        className="card-title-link"
                        href={`${base}/routes/${route.id}`}
                      >
                        {route.title ?? "Ruta sin título"}
                      </Link>
                    </h3>
                    <p className="muted">{route.objective}</p>
                    <div className="draft-card-actions">
                      <Link
                        className="button secondary small"
                        href={`${base}/routes/${route.id}`}
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        Revisar
                      </Link>
                      <DeleteDraftForm
                        from="inicio"
                        generating={route.generationStatus === "generando"}
                        routeId={route.id}
                        spaceId={space.id}
                        title={route.title ?? "Ruta sin título"}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <>
          {nextRoute ? (
            <section aria-label="Continuar" className="card continue-card">
              <div>
                <p className="eyebrow">
                  {nextRoute.view.started
                    ? "Continúa donde lo dejaste"
                    : "Tu siguiente ruta"}
                </p>
                <h2>{nextRoute.view.title}</h2>
                <p className="muted">
                  {nextRoute.view.resolvedSteps} de {nextRoute.view.totalSteps}{" "}
                  pasos resueltos
                </p>
              </div>
              <Link
                className="button"
                href={`${base}/routes/${nextRoute.route.id}/learn`}
              >
                {nextRoute.view.started ? "Continuar" : "Empezar"}
                <Icon name="arrowRight" size={18} />
              </Link>
            </section>
          ) : learnerViews.length > 0 ? (
            <p className="notice" role="status">
              <Icon name="check" size={18} />
              Completaste todas las rutas publicadas de este espacio.
            </p>
          ) : null}

          <section className="section">
            <div className="section-header">
              <h2>Tus rutas</h2>
            </div>
            {learnerViews.length === 0 ? (
              <div className="empty-state">
                <Icon name="route" size={28} />
                <h3>Aún no hay rutas publicadas</h3>
                <p>
                  Cuando una persona responsable publique una ruta aparecerá
                  aquí. Mientras tanto puedes preguntar sobre las fuentes del
                  espacio.
                </p>
                <Link className="button secondary" href={`${base}/assistant`}>
                  <Icon name="assistant" size={18} />
                  Hacer una consulta
                </Link>
              </div>
            ) : (
              <ul className="grid space-grid">
                {learnerViews.map(({ route, view }) => (
                  <LearnerRouteCard
                    key={route.id}
                    route={route}
                    spaceId={space.id}
                    view={view}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
