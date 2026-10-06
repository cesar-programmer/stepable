import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { AutoRefresh } from "@/app/components/auto-refresh";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import type { RouteDetail, RouteStep } from "@/modules/routes/contract";
import { readRoute } from "@/modules/routes/service";
import { PostgresSourceRepository } from "@/adapters/postgres/source-repository";

import {
  deleteStepAction,
  moveStepAction,
  publishRouteAction,
  regenerateRouteAction,
  saveStepAction,
} from "../actions";
import {
  citationStateLabels,
  requestedActivityLabels,
  routeErrorMessages,
  routeGenerationLabels,
  routeNoticeMessages,
} from "../messages";
import { CodeBlock } from "../code-block";

import { GenerationRecovery } from "./generation-recovery";

type RoutePageProps = {
  params: Promise<{ spaceId: string; routeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function HiddenRouteFields({
  spaceId,
  route,
  stepId,
}: {
  spaceId: string;
  route: RouteDetail;
  stepId?: string;
}) {
  return (
    <>
      <input name="spaceId" type="hidden" value={spaceId} />
      <input name="routeId" type="hidden" value={route.id} />
      <input name="editVersion" type="hidden" value={route.editVersion} />
      {stepId ? <input name="stepId" type="hidden" value={stepId} /> : null}
    </>
  );
}

function Citations({ spaceId, step }: { spaceId: string; step: RouteStep }) {
  return (
    <ul className="citation-list">
      {step.citations.map((citation) => (
        <li key={citation.ref}>
          [{citation.ref}]{" "}
          {citation.state === "fuente_eliminada" ? (
            citation.sourceTitle
          ) : (
            <Link href={`/spaces/${spaceId}/sources/${citation.sourceId}`}>
              {citation.sourceTitle}
            </Link>
          )}{" "}
          · versión {citation.versionNumber} · {citation.location}
          {citation.state !== "vigente" ? (
            <span className="status fallida">
              {citationStateLabels[citation.state]}
              {citation.currentVersionNumber
                ? ` (vigente: versión ${citation.currentVersionNumber})`
                : ""}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ReadOnlyStep({ spaceId, step }: { spaceId: string; step: RouteStep }) {
  return (
    <li>
      <h2>
        {step.position}. {step.title}
      </h2>
      <p className="answer-text">{step.lesson}</p>
      <Citations spaceId={spaceId} step={step} />
      {step.code ? <CodeBlock code={step.code} /> : null}
      <p>
        <strong>Pregunta:</strong> {step.question}
      </p>
      {step.activityType === "completar" ? (
        <p className="muted">
          Actividad: completar el hueco del código con un fragmento exacto.
        </p>
      ) : (
        <ol type="A">
          {step.options.map((option, index) => (
            <li key={index}>{option}</li>
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
          ))}{" "}
          · {step.explanation}
        </p>
      ) : null}
      {step.correctOption !== null ? (
        <p className="muted">
          Respuesta correcta: {String.fromCharCode(65 + step.correctOption)} ·{" "}
          {step.explanation}
        </p>
      ) : null}
    </li>
  );
}

function EditableStep({
  spaceId,
  route,
  step,
}: {
  spaceId: string;
  route: RouteDetail;
  step: RouteStep;
}) {
  const options = [...step.options, "", "", "", ""].slice(0, 4);
  return (
    <li className="route-step-editor">
      <form action={saveStepAction}>
        <HiddenRouteFields route={route} spaceId={spaceId} stepId={step.id} />
        <label>
          Título del paso {step.position}
          <input
            defaultValue={step.title}
            maxLength={120}
            name="title"
            required
          />
        </label>
        <label>
          Lección (cita con [n])
          <textarea
            defaultValue={step.lesson}
            name="lesson"
            required
            rows={5}
          />
        </label>
        <Citations spaceId={spaceId} step={step} />
        <label>
          Tipo de actividad
          <select defaultValue={step.activityType} name="activityType">
            <option value="opcion_multiple">Opción múltiple</option>
            <option value="completar">
              Completar el hueco del código (respuesta escrita)
            </option>
          </select>
        </label>
        <label>
          Código de solo lectura (opcional; vacío para quitarlo; para
          “completar”, obligatorio con un único [[hueco]])
          <textarea
            className="code-input"
            defaultValue={step.code?.content ?? ""}
            maxLength={3000}
            name="code"
            rows={6}
            spellCheck={false}
            wrap="off"
          />
        </label>
        <label>
          Lenguaje del código (opcional)
          <input
            defaultValue={step.code?.language ?? ""}
            maxLength={30}
            name="codeLanguage"
            placeholder="por ejemplo, typescript"
          />
        </label>
        <label>
          Origen del código
          <select
            defaultValue={step.code?.origin ?? "ilustrativo"}
            name="codeOrigin"
          >
            <option value="fuente">
              Copiado literalmente de una fuente citada
            </option>
            <option value="ilustrativo">Ejemplo ilustrativo</option>
          </select>
        </label>
        <label>
          Pregunta
          <input defaultValue={step.question} name="question" required />
        </label>
        {options.map((option, index) => (
          <label key={index}>
            Opción {String.fromCharCode(65 + index)}
            {index >= 3 ? " (opcional)" : ""}
            <input defaultValue={option} name={`option${index}`} />
          </label>
        ))}
        <label>
          Respuesta correcta (solo opción múltiple)
          <select
            defaultValue={String(step.correctOption ?? 0)}
            name="correctOption"
          >
            {options.map((_, index) => (
              <option key={index} value={index}>
                Opción {String.fromCharCode(65 + index)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Respuestas aceptadas (solo “completar”; una por línea, la primera es
          la principal; se comparan exactas, ignorando solo espacios al inicio y
          al final)
          <textarea
            className="code-input"
            defaultValue={(step.acceptedAnswers ?? []).join("\n")}
            name="acceptedAnswers"
            rows={3}
            spellCheck={false}
          />
        </label>
        <label>
          Explicación
          <textarea
            defaultValue={step.explanation ?? ""}
            name="explanation"
            required
            rows={3}
          />
        </label>
        <button type="submit">Guardar paso {step.position}</button>
      </form>
      <div className="actions compact">
        {(["up", "down"] as const).map((direction) => (
          <form action={moveStepAction} className="inline-form" key={direction}>
            <HiddenRouteFields
              route={route}
              spaceId={spaceId}
              stepId={step.id}
            />
            <input name="direction" type="hidden" value={direction} />
            <button
              className="secondary"
              disabled={
                direction === "up"
                  ? step.position === 1
                  : step.position === route.steps.length
              }
              type="submit"
            >
              {direction === "up" ? "Subir" : "Bajar"} paso {step.position}
            </button>
          </form>
        ))}
        <form action={deleteStepAction} className="inline-form">
          <HiddenRouteFields route={route} spaceId={spaceId} stepId={step.id} />
          <ConfirmSubmitButton
            className="danger"
            message={`¿Eliminar el paso ${step.position} del borrador?`}
          >
            Eliminar paso {step.position}
          </ConfirmSubmitButton>
        </form>
      </div>
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

  return (
    <main className="wide">
      <AutoRefresh active={canManage && generating} />
      <p className="eyebrow">
        {route.status === "publicada"
          ? "Ruta publicada · solo lectura"
          : `Borrador · ${routeGenerationLabels[route.generationStatus]}`}
      </p>
      <h1>{route.title ?? "Ruta sin título"}</h1>
      <p>
        <strong>Objetivo:</strong> {route.objective}
      </p>
      {canManage ? (
        <p className="muted">
          Tipos de actividad solicitados:{" "}
          {route.requestedActivities
            .map((type) => requestedActivityLabels[type])
            .join(", ")}
        </p>
      ) : null}
      {generating ? (
        <p className="notice" role="status">
          Generando el borrador. Puede tardar un minuto; la página se actualiza
          sola.
        </p>
      ) : showNotice ? (
        <p className="notice">{routeNoticeMessages[notice]}</p>
      ) : null}
      {error && routeErrorMessages[error] ? (
        <p className="error" role="alert">
          {routeErrorMessages[error]}
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
      {route.needsReview ? (
        <p className="error" role="alert">
          Revisar: alguna fuente citada fue reemplazada o eliminada. El
          contenido de la ruta no cambió; las citas afectadas están señaladas.
        </p>
      ) : null}
      {canManage ? (
        <p className="muted">
          Fuentes seleccionadas:{" "}
          {route.sources
            .map((source) =>
              source.active ? source.title : "(fuente eliminada)",
            )
            .join(", ")}
        </p>
      ) : null}

      <ol className="route-steps">
        {route.steps.map((step) =>
          editable ? (
            <EditableStep
              key={step.id}
              route={route}
              spaceId={spaceId}
              step={step}
            />
          ) : (
            <ReadOnlyStep key={step.id} spaceId={spaceId} step={step} />
          ),
        )}
      </ol>

      {canManage &&
      route.status === "borrador" &&
      !generating &&
      !recovering ? (
        <div className="actions">
          {editable ? (
            <form action={publishRouteAction} className="inline-form">
              <HiddenRouteFields route={route} spaceId={spaceId} />
              <ConfirmSubmitButton message="¿Publicar esta ruta? La versión publicada no se podrá editar.">
                Publicar ruta
              </ConfirmSubmitButton>
            </form>
          ) : null}
          <form action={regenerateRouteAction} className="inline-form">
            <HiddenRouteFields route={route} spaceId={spaceId} />
            <ConfirmSubmitButton
              className="secondary"
              message="¿Regenerar? Reemplaza el borrador actual y cuenta como un intento del límite diario."
            >
              Regenerar borrador
            </ConfirmSubmitButton>
          </form>
        </div>
      ) : null}

      <div className="actions">
        {route.status === "publicada" ? (
          <Link
            className="button"
            href={`/spaces/${spaceId}/routes/${route.id}/learn`}
          >
            Recorrer ruta
          </Link>
        ) : null}
        {canManage && route.status === "publicada" ? (
          <Link
            className="button secondary"
            href={`/spaces/${spaceId}/routes/${route.id}/progress`}
          >
            Progreso del equipo
          </Link>
        ) : null}
        <Link className="button secondary" href={`/spaces/${spaceId}/routes`}>
          Volver a rutas
        </Link>
      </div>
    </main>
  );
}
