"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Icon, type IconName } from "@/app/components/icons";
import { Presence } from "@/app/components/motion";
import { SubmitButton } from "@/app/components/submit-button";

import { createRouteFormAction, type CreateRouteState } from "../actions";
import { routeErrorMessages } from "../messages";

type Activity = "opcion_multiple" | "lectura_codigo" | "completar";

const activities: {
  key: Activity;
  label: string;
  icon: IconName;
  description: string;
}[] = [
  {
    key: "opcion_multiple",
    label: "Opción múltiple",
    icon: "check",
    description: "Una pregunta con 3 o 4 opciones y una respuesta correcta.",
  },
  {
    key: "lectura_codigo",
    label: "Lectura de código",
    icon: "book",
    description:
      "Un fragmento de código de las fuentes y una pregunta sobre él.",
  },
  {
    key: "completar",
    label: "Completar código",
    icon: "sources",
    description: "Un fragmento con un hueco que se completa con texto exacto.",
  },
];

export type CreatableSource = {
  id: string;
  title: string;
  versionNumber: number;
  format: string;
  hasCodeBlock: boolean;
};

/**
 * One page, three sections. Selecting or typing never calls the model:
 * only "Generar borrador" queues one generation.
 */
export function CreateRouteForm({
  spaceId,
  sources,
  maxSources,
  objectiveMin,
  objectiveMax,
  generationsLeftToday,
  dailyGenerations,
}: {
  spaceId: string;
  sources: CreatableSource[];
  maxSources: number;
  objectiveMin: number;
  objectiveMax: number;
  generationsLeftToday: number;
  dailyGenerations: number;
}) {
  const [state, formAction] = useActionState<CreateRouteState, FormData>(
    createRouteFormAction,
    { error: null },
  );
  const [objective, setObjective] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [kinds, setKinds] = useState<Activity[]>(["opcion_multiple"]);
  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
  const codeRequested = kinds.some((kind) => kind !== "opcion_multiple");
  const selectedSources = sources.filter((source) =>
    selected.includes(source.id),
  );
  const noCodeDetected =
    codeRequested &&
    selectedSources.length > 0 &&
    !selectedSources.some((source) => source.hasCodeBlock);
  const objectiveLength = objective.trim().length;

  return (
    <form action={formAction} className="create-route">
      <input name="spaceId" type="hidden" value={spaceId} />
      {state.error ? (
        <p className="error" role="alert">
          <Icon name="alert" size={18} />
          {routeErrorMessages[state.error] ??
            "No se pudo crear la ruta. Revisa los datos e inténtalo de nuevo."}
        </p>
      ) : null}

      <section aria-labelledby="paso-objetivo" className="card form-section">
        <h2 id="paso-objetivo">
          <span className="section-number">1</span>
          Qué aprenderá el equipo
        </h2>
        <label htmlFor="objective">Objetivo de aprendizaje</label>
        <textarea
          aria-describedby="objective-help"
          id="objective"
          maxLength={objectiveMax}
          minLength={objectiveMin}
          name="objective"
          onChange={(event) => setObjective(event.target.value)}
          required
          rows={3}
          value={objective}
        />
        <p className="field-help" id="objective-help">
          Por ejemplo: «Que una persona nueva sepa versionar y publicar un
          contrato de API sin romper a los clientes». Entre {objectiveMin} y{" "}
          {objectiveMax} caracteres.
        </p>
      </section>

      <section aria-labelledby="paso-fuentes" className="card form-section">
        <div className="form-section-header">
          <h2 id="paso-fuentes">
            <span className="section-number">2</span>
            Con qué documentos
          </h2>
          <span
            aria-live="polite"
            className={`badge ${selected.length > maxSources ? "danger" : "neutral"}`}
          >
            {selected.length} de {maxSources}
          </span>
        </div>
        {sources.length === 0 ? (
          <div className="empty-state">
            <p>No hay fuentes listas en el espacio.</p>
            <Link
              className="button secondary"
              href={`/spaces/${spaceId}/sources`}
            >
              <Icon name="upload" size={18} />
              Cargar fuentes
            </Link>
          </div>
        ) : (
          <fieldset className="choice-list">
            <legend className="sr-only">Fuentes</legend>
            {sources.map((source) => (
              <label className="choice" key={source.id}>
                <input
                  checked={selected.includes(source.id)}
                  disabled={
                    !selected.includes(source.id) &&
                    selected.length >= maxSources
                  }
                  name="sourceIds"
                  onChange={() => setSelected(toggle(selected, source.id))}
                  type="checkbox"
                  value={source.id}
                />
                <span className="choice-text">
                  <span>
                    {source.title} · versión {source.versionNumber}
                  </span>
                  <span className="muted">
                    {source.format === "pdf" ? "PDF" : "Markdown"}
                    {source.hasCodeBlock
                      ? " · bloques de código detectados"
                      : ""}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <p className="field-help">
          ¿Falta un documento?{" "}
          <Link href={`/spaces/${spaceId}/sources`}>Carga fuentes</Link> y
          vuelve cuando estén listas.
        </p>
      </section>

      <section aria-labelledby="paso-practica" className="card form-section">
        <h2 id="paso-practica">
          <span className="section-number">3</span>
          Cómo practicarán
        </h2>
        <fieldset className="activity-cards">
          <legend className="sr-only">Tipos de actividad</legend>
          {activities.map((activity) => (
            <label className="activity-card" key={activity.key}>
              <input
                checked={kinds.includes(activity.key)}
                className="sr-only"
                name="activityTypes"
                onChange={() => setKinds(toggle(kinds, activity.key))}
                type="checkbox"
                value={activity.key}
              />
              <span className="activity-card-icon">
                <Icon name={activity.icon} />
              </span>
              <span className="activity-card-label">{activity.label}</span>
              <span className="activity-card-text">{activity.description}</span>
              <span aria-hidden="true" className="activity-card-check">
                <Icon name="check" size={16} />
              </span>
            </label>
          ))}
        </fieldset>
        <p className="field-help">
          El borrador incluirá al menos un paso de cada tipo elegido. Si las
          fuentes no lo respaldan, quedará como evidencia insuficiente en lugar
          de cambiar de tipo.
        </p>
        <Presence show={noCodeDetected}>
          <p className="callout" role="status">
            <Icon name="alert" size={18} />
            No detectamos bloques de código en las fuentes elegidas. Si hay
            código en otro formato (por ejemplo, en un PDF), puedes intentarlo
            igualmente.
          </p>
        </Presence>
      </section>

      <aside aria-label="Resumen" className="card create-summary">
        <h2>Resumen</h2>
        <dl>
          <div>
            <dt>Objetivo</dt>
            <dd>
              {objectiveLength >= objectiveMin
                ? "Listo"
                : `Faltan ${objectiveMin - objectiveLength} caracteres`}
            </dd>
          </div>
          <div>
            <dt>Fuentes</dt>
            <dd>{selected.length === 0 ? "Ninguna" : selected.length}</dd>
          </div>
          <div>
            <dt>Actividades</dt>
            <dd>
              {kinds.length === 0
                ? "Ninguna"
                : activities
                    .filter((activity) => kinds.includes(activity.key))
                    .map((activity) => activity.label)
                    .join(", ")}
            </dd>
          </div>
        </dl>
        <SubmitButton
          disabled={
            generationsLeftToday === 0 ||
            objectiveLength < objectiveMin ||
            selected.length === 0 ||
            kinds.length === 0
          }
          pendingLabel="Enviando…"
        >
          <Icon name="spark" size={18} />
          Generar borrador
        </SubmitButton>
        <p className="field-help">
          {generationsLeftToday > 0
            ? `La IA redacta un borrador que revisarás antes de publicar. Usa 1 intento (quedan ${generationsLeftToday} de ${dailyGenerations} hoy en el espacio).`
            : `Se agotaron los ${dailyGenerations} intentos de hoy en el espacio. Se restablecen a las 00:00 UTC.`}
        </p>
      </aside>
    </form>
  );
}
