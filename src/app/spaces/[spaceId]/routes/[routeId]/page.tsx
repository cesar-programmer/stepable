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

import {
  deleteStepAction,
  moveStepAction,
  publishRouteAction,
  regenerateRouteAction,
  saveStepAction,
} from "../actions";
import {
  citationStateLabels,
  routeErrorMessages,
  routeGenerationLabels,
  routeNoticeMessages,
} from "../messages";

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
      <p>
        <strong>Pregunta:</strong> {step.question}
      </p>
      <ol type="A">
        {step.options.map((option, index) => (
          <li key={index}>{option}</li>
        ))}
      </ol>
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
          Respuesta correcta
          <select
            defaultValue={String(step.correctOption)}
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
  const { canManage, route } = result;

  const query = await searchParams;
  const notice = typeof query.notice === "string" ? query.notice : "";
  const error =
    typeof query.error === "string"
      ? query.error
      : (route.generationError ?? "");
  const generating = ["en_cola", "generando"].includes(route.generationStatus);
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
      {notice && routeNoticeMessages[notice] ? (
        <p className="notice">{routeNoticeMessages[notice]}</p>
      ) : null}
      {error && routeErrorMessages[error] ? (
        <p className="error" role="alert">
          {routeErrorMessages[error]}
        </p>
      ) : null}
      {route.generationStatus === "insuficiente" ? (
        <p className="error" role="alert">
          Las fuentes seleccionadas no contienen evidencia suficiente para este
          objetivo. No se inventaron pasos.
        </p>
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

      {canManage && route.status === "borrador" && !generating ? (
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
