import Link from "next/link";

import {
  requestedActivityTypes,
  routeLimits,
  type RouteDetail,
} from "@/modules/routes/contract";
import type { SourceSummary } from "@/modules/sources/contract";

import {
  generateWithChangesAction,
  saveRouteRequestAction,
  multipleChoiceOnlyAction,
} from "../actions";
import { requestedActivityLabels, routeErrorMessages } from "../messages";

const labels = (types: string[]) =>
  types.map((type) => requestedActivityLabels[type] ?? type).join(", ");

/** Time left until the daily limit resets at 00:00 UTC. */
function untilUtcMidnight(now: Date): string {
  const reset = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  const minutes = Math.ceil((reset - now.getTime()) / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

function Hidden({ spaceId, route }: { spaceId: string; route: RouteDetail }) {
  return (
    <>
      <input name="spaceId" type="hidden" value={spaceId} />
      <input name="routeId" type="hidden" value={route.id} />
      <input name="editVersion" type="hidden" value={route.editVersion} />
    </>
  );
}

/**
 * Shown for a draft whose generation failed or lacked evidence: explains
 * what happened and lets the responsible adjust objective, sources and
 * activity types of the same route. Saving never calls the model; only
 * "Generar con estos cambios" queues one generation (one attempt).
 */
export function GenerationRecovery({
  spaceId,
  route,
  readySources,
  generationsLeftToday,
  saved,
}: {
  spaceId: string;
  route: RouteDetail;
  readySources: SourceSummary[];
  generationsLeftToday: number;
  saved: boolean;
}) {
  const missingTypes = route.generationError === "tipos_no_cubiertos";
  const insufficient = route.generationStatus === "insuficiente";
  const codeRequested = route.requestedActivities.some(
    (type) => type !== "opcion_multiple",
  );
  const selected = new Set(route.sources.map((source) => source.id));
  const readyIds = new Set(readySources.map((source) => source.id));
  const withCode = route.sources.filter((source) => source.hasCodeBlock);
  const missing = new Set(route.missingActivities ?? []);

  const title = insufficient
    ? "No hay evidencia suficiente"
    : missingTypes
      ? "Faltaron actividades solicitadas"
      : "La generación falló por un problema técnico";
  const explanation = insufficient
    ? "Las fuentes seleccionadas no tienen información suficiente para este objetivo y estas actividades. No se inventaron pasos ni se cambiaron las actividades."
    : missingTypes
      ? `El borrador generado no incluía al menos un paso de cada actividad solicitada (${labels(route.requestedActivities)}).${route.missingActivities ? ` Faltaron: ${labels(route.missingActivities)}.` : ""} No se aceptó para no sustituir actividades sin tu decisión.`
      : (routeErrorMessages[route.generationError ?? ""] ??
        "No se pudo completar la generación.");

  return (
    <section aria-label="Recuperar la generación" className="assistant-answer">
      <h2>{title}</h2>
      <p role="alert">{explanation}</p>
      {codeRequested && (insufficient || missingTypes) ? (
        <p className="muted" data-testid="code-evidence">
          {withCode.length === 0
            ? "No detectamos bloques de código en las fuentes seleccionadas, y los ejercicios de lectura o completar código necesitan código de las fuentes."
            : `Detectamos bloques de código en: ${withCode.map((source) => source.title).join(", ")}.`}{" "}
          Solo detectamos bloques delimitados con <code>{"```"}</code>; el
          código en otro formato (por ejemplo, en un PDF) puede estar y no
          detectarse.
        </p>
      ) : null}
      <p>Qué puedes hacer:</p>
      <ul>
        <li>
          <a href="#actividades">Cambiar actividades</a>: quita las que no se
          pudieron generar.
        </li>
        <li>
          <a href="#fuentes">Cambiar fuentes</a>: elige otras o{" "}
          <Link href={`/spaces/${spaceId}/sources/upload`}>
            carga documentos
          </Link>
          .
        </li>
        <li>
          <a href="#objetivo">Editar objetivo</a>: precisa qué debe aprender la
          persona.
        </li>
      </ul>
      {codeRequested ? (
        <form action={multipleChoiceOnlyAction} className="inline-form">
          <Hidden route={route} spaceId={spaceId} />
          <input name="objective" type="hidden" value={route.objective} />
          {route.sources
            .filter((source) => readyIds.has(source.id))
            .map((source) => (
              <input
                key={source.id}
                name="sourceIds"
                type="hidden"
                value={source.id}
              />
            ))}
          <button className="secondary" type="submit">
            Usar solo opción múltiple
          </button>
          <span className="muted">
            {" "}
            Solo cambia las actividades; no genera nada.
          </span>
        </form>
      ) : null}
      {saved ? (
        <p className="muted" role="status">
          Cambios guardados. Todavía no se generó nada.
        </p>
      ) : null}

      {/* Remounted on every saved change so the fields show stored values. */}
      <form action={saveRouteRequestAction} key={route.editVersion}>
        <Hidden route={route} spaceId={spaceId} />
        <fieldset id="objetivo">
          <legend>Editar objetivo</legend>
          <label>
            Objetivo de aprendizaje
            <textarea
              defaultValue={route.objective}
              maxLength={routeLimits.objectiveMaxChars}
              minLength={routeLimits.objectiveMinChars}
              name="objective"
              required
              rows={3}
            />
          </label>
        </fieldset>
        <fieldset id="fuentes">
          <legend>
            Cambiar fuentes (hasta {routeLimits.maxSources}; solo fuentes
            listas)
          </legend>
          {readySources.map((source) => (
            <label className="checkbox" key={source.id}>
              <input
                defaultChecked={selected.has(source.id)}
                name="sourceIds"
                type="checkbox"
                value={source.id}
              />
              {source.title} · versión {source.versionNumber}
            </label>
          ))}
          <p className="muted">
            <Link href={`/spaces/${spaceId}/sources/upload`}>
              Cargar documentos
            </Link>{" "}
            (cuando estén listos, aparecerán aquí).
          </p>
        </fieldset>
        <fieldset id="actividades">
          <legend>Cambiar actividades</legend>
          {requestedActivityTypes.map((type) => (
            <label className="checkbox" key={type}>
              <input
                defaultChecked={route.requestedActivities.includes(type)}
                name="activityTypes"
                type="checkbox"
                value={type}
              />
              {requestedActivityLabels[type]}
              {missing.has(type) ? " (no se pudo generar)" : ""}
            </label>
          ))}
        </fieldset>
        <div className="actions">
          <button className="secondary" type="submit">
            Guardar cambios
          </button>
          <button
            disabled={generationsLeftToday === 0}
            formAction={generateWithChangesAction}
            type="submit"
          >
            Generar con estos cambios
          </button>
        </div>
        <p className="muted">
          {generationsLeftToday > 0
            ? `Generar consume 1 intento (quedan ${generationsLeftToday} de ${routeLimits.dailyGenerationAttempts} hoy en el espacio) y hace una llamada al modelo de IA. No se reintenta automáticamente. Guardar cambios no genera nada.`
            : `Se agotaron los ${routeLimits.dailyGenerationAttempts} intentos de hoy en el espacio. Podrás volver a generar a partir de las 00:00 UTC (dentro de ${untilUtcMidnight(new Date())}). Puedes guardar los cambios mientras tanto.`}
        </p>
      </form>
    </section>
  );
}
