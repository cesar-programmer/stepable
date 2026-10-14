import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { PostgresSourceRepository } from "@/adapters/postgres/source-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { AutoRefresh } from "@/app/components/auto-refresh";
import { Icon } from "@/app/components/icons";
import type { RouteStep } from "@/modules/routes/contract";
import { readRoute } from "@/modules/routes/service";

import { CodeBlock } from "../code-block";
import {
  citationStateLabels,
  requestedActivityLabels,
  routeErrorMessages,
  routeNoticeMessages,
  routeState,
} from "../messages";

import { DeleteDraftForm } from "../delete-draft-form";
import { GenerationRecovery } from "./generation-recovery";
import { RouteEditor } from "./route-editor";

type RoutePageProps = {
  params: Promise<{ spaceId: string; routeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const letter = (index: number) => String.fromCharCode(65 + index);

/** Published (or not editable) routes: readable, without form fields. */
function ReadOnlyStep({ spaceId, step }: { spaceId: string; step: RouteStep }) {
  return (
    <li className="card read-step">
      <p className="eyebrow">Paso {step.position}</p>
      <h2>{step.title}</h2>
      <p className="answer-text">{step.lesson}</p>
      {step.code ? <CodeBlock code={step.code} /> : null}
      <p>
        <strong>Pregunta:</strong> {step.question}
      </p>
      {step.activityType === "completar" ? (
        <p className="muted">
          Actividad: completar el hueco del código con un fragmento exacto.
        </p>
      ) : (
        <ol className="read-options">
          {step.options.map((option, index) => (
            <li
              className={
                step.correctOption === index ? "is-correct" : undefined
              }
              key={index}
            >
              <span className="option-letter">{letter(index)}</span>
              {option}
              {step.correctOption === index ? (
                <span className="badge success">Correcta</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {step.acceptedAnswers ? (
        <p className="muted">
          Respuestas aceptadas:{" "}
          {step.acceptedAnswers.map((answer, index) => (
            <span key={index}>
              {index > 0 ? " · " : ""}
              <code>{answer}</code>
              {index === 0 ? " (principal)" : ""}
            </span>
          ))}
        </p>
      ) : null}
      {step.explanation ? (
        <p className="muted">
          <strong>Explicación:</strong> {step.explanation}
        </p>
      ) : null}
      <details className="citations">
        <summary>
          <Icon name="sources" size={16} />
          Fuentes citadas ({step.citations.length})
        </summary>
        <ul>
          {step.citations.map((citation) => (
            <li key={citation.ref}>
              <span className="citation-ref">[{citation.ref}]</span>
              {citation.state === "fuente_eliminada" ? (
                citation.sourceTitle
              ) : (
                <Link href={`/spaces/${spaceId}/sources/${citation.sourceId}`}>
                  {citation.sourceTitle}
                </Link>
              )}
              <span className="muted">
                versión {citation.versionNumber} · {citation.location}
              </span>
              {citation.state !== "vigente" ? (
                <span className="badge warning">
                  {citationStateLabels[citation.state]}
                  {citation.currentVersionNumber
                    ? ` (vigente: versión ${citation.currentVersionNumber})`
                    : ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

export default async function RoutePage({
  params,
  searchParams,
}: RoutePageProps) {
  const parsed = z
    .object({ spaceId: z.uuid(), routeId: z.uuid() })
    .safeParse(await params);
  if (!parsed.success) notFound();
  const { spaceId, routeId } = parsed.data;

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${spaceId}/routes/${routeId}`)}`,
    );
  }
  const database = getApplicationDatabase();
  const result = await readRoute(
    {
      accessRepository: new PostgresAccessRepository(database),
      routeRepository: new PostgresRouteRepository(database, null),
    },
    { identityId: currentIdentity.id, spaceId, routeId },
  );
  if (!result) notFound();
  const { canManage, route, generationsLeftToday } = result;

  const query = await searchParams;
  const notice = typeof query.notice === "string" ? query.notice : "";
  // Only action errors come from the URL; the generation outcome is read
  // from the route itself, so a stale message never outlives its state.
  const error = typeof query.error === "string" ? query.error : "";
  const initialStep = typeof query.paso === "string" ? query.paso : null;
  const generating = ["en_cola", "generando"].includes(route.generationStatus);
  const recovering =
    canManage &&
    route.status === "borrador" &&
    ["insuficiente", "fallida"].includes(route.generationStatus);
  const showNotice =
    Boolean(routeNoticeMessages[notice]) &&
    (notice === "generation_queued" ? generating : notice !== "request_saved");
  const readySources = recovering
    ? await new PostgresSourceRepository(database, null).listSources(
        spaceId,
        true,
      )
    : [];
  const editable =
    canManage &&
    route.status === "borrador" &&
    route.generationStatus === "lista";
  const state = routeState(route);

  return (
    <main className={editable ? "editor-page" : undefined}>
      <AutoRefresh active={canManage && generating} />
      <div className="page-header route-header">
        <div className="route-header-text">
          <Link className="back-link" href={`/spaces/${spaceId}/routes`}>
            <Icon className="flip" name="chevronRight" size={16} />
            Rutas
          </Link>
          <div className="route-title-row">
            <h1>{route.title ?? "Ruta sin título"}</h1>
            <span className={`badge ${state.tone}`}>{state.label}</span>
          </div>
          <p className="route-objective">
            <strong>Objetivo:</strong> {route.objective}
          </p>
          {canManage ? (
            <p className="meta">
              <span>
                Actividades:{" "}
                {route.requestedActivities
                  .map((type) => requestedActivityLabels[type])
                  .join(", ")}
              </span>
              {route.sources.length > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Fuentes:{" "}
                    {route.sources
                      .map((source) =>
                        source.active ? source.title : "(fuente eliminada)",
                      )
                      .join(", ")}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {route.status === "publicada" ? (
          <div className="actions compact">
            {canManage ? (
              <Link
                className="button secondary"
                href={`/spaces/${spaceId}/routes/${route.id}/progress`}
              >
                <Icon name="progress" size={18} />
                Progreso del equipo
              </Link>
            ) : null}
            <Link
              className="button"
              href={`/spaces/${spaceId}/routes/${route.id}/learn`}
            >
              Recorrer ruta
              <Icon name="arrowRight" size={18} />
            </Link>
          </div>
        ) : canManage ? (
          <div className="actions compact">
            <DeleteDraftForm
              from="ruta"
              generating={route.generationStatus === "generando"}
              label="Eliminar borrador"
              routeId={route.id}
              spaceId={spaceId}
              title={route.title ?? "Ruta sin título"}
            />
          </div>
        ) : null}
      </div>

      {generating ? (
        <p className="callout" role="status">
          <span aria-hidden="true" className="spinner" />
          Generando el borrador. Puede tardar un minuto; la página se actualiza
          sola.
        </p>
      ) : showNotice ? (
        <p className="notice" role="status">
          <Icon name="check" size={18} />
          {routeNoticeMessages[notice]}
        </p>
      ) : null}
      {error && routeErrorMessages[error] ? (
        <p className="error" role="alert">
          <Icon name="alert" size={18} />
          {routeErrorMessages[error]}
        </p>
      ) : null}
      {route.needsReview ? (
        <p className="error" role="alert">
          <Icon name="alert" size={18} />
          Alguna fuente citada fue reemplazada o eliminada. El contenido de la
          ruta no cambió; las citas afectadas están señaladas.
        </p>
      ) : null}

      {recovering ? (
        <GenerationRecovery
          generationsLeftToday={generationsLeftToday ?? 0}
          readySources={readySources}
          route={route}
          saved={notice === "request_saved"}
          spaceId={spaceId}
        />
      ) : null}

      {editable && route.steps.length > 0 ? (
        <RouteEditor
          editVersion={route.editVersion}
          initialStepId={initialStep}
          routeId={route.id}
          spaceId={spaceId}
          steps={route.steps}
        />
      ) : route.steps.length > 0 ? (
        <ol className="read-steps">
          {route.steps.map((step) => (
            <ReadOnlyStep key={step.id} spaceId={spaceId} step={step} />
          ))}
        </ol>
      ) : null}
    </main>
  );
}
