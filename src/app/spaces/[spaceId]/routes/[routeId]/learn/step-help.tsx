"use client";

import Link from "next/link";
import { useActionState } from "react";

import { askStepHelpAction, type StepHelpState } from "./actions";

const messages: Record<string, string> = {
  insufficient:
    "No encontré información suficiente en las fuentes vigentes del espacio para ayudarte con este paso.",
  retrieval_only:
    "El modelo de conversación no está configurado; se muestran solo los fragmentos encontrados.",
  unverifiable:
    "La ayuda del modelo no se pudo verificar contra los fragmentos recuperados y no se muestra.",
  model_error:
    "No fue posible obtener ayuda del modelo. Inténtalo de nuevo más tarde.",
  invalid_question: "Escribe una duda de 3 a 500 caracteres o déjala vacía.",
  unauthorized: "No tienes acceso a esta ruta o a las fuentes del espacio.",
  not_found: "No se encontró el paso.",
  not_started: "Primero empieza la ruta.",
  locked: "Este paso todavía está bloqueado.",
  authentication_required: "Tu sesión terminó. Inicia sesión de nuevo.",
};

export function StepHelp({
  spaceId,
  routeId,
  stepId,
  resolved,
}: {
  spaceId: string;
  routeId: string;
  stepId: string;
  resolved: boolean;
}) {
  const [state, formAction, pending] = useActionState<StepHelpState, FormData>(
    askStepHelpAction,
    { kind: "idle" },
  );
  const fragments = "fragments" in state ? state.fragments : [];

  return (
    <section aria-label="Ayuda del asistente" className="step-help">
      <p className="muted">
        {resolved
          ? "El paso está resuelto: el asistente puede explicarte la respuesta con apoyo en las fuentes."
          : "Mientras el paso no esté resuelto, el asistente explica conceptos y orienta hacia las fuentes, con la indicación de no elegir una opción por ti; aun así, su ayuda puede revelar o permitir deducir la respuesta. Pedir ayuda no consume intentos."}
      </p>
      <form action={formAction}>
        <input name="spaceId" type="hidden" value={spaceId} />
        <input name="routeId" type="hidden" value={routeId} />
        <input name="stepId" type="hidden" value={stepId} />
        <label>
          Tu duda (opcional)
          <textarea
            defaultValue={"question" in state ? state.question : ""}
            maxLength={500}
            name="question"
            rows={2}
          />
        </label>
        <button className="secondary" disabled={pending} type="submit">
          {pending ? "Consultando…" : "Pedir ayuda"}
        </button>
      </form>

      {"sourcesChanged" in state && state.sourcesChanged ? (
        <p className="error" role="alert">
          Alguna fuente de este paso cambió o se eliminó después de publicar la
          ruta. La ayuda usa las versiones vigentes, que pueden no coincidir con
          la lección.
        </p>
      ) : null}

      {state.kind === "answered" ? (
        <section
          aria-label="Respuesta del asistente"
          className="assistant-answer"
        >
          <p className="eyebrow">
            {state.mode === "pistas" ? "Ayuda para comprender" : "Explicación"}
          </p>
          <p className="answer-text">{state.answer}</p>
          <ol className="citation-list">
            {state.citations.map((citation) => (
              <li key={citation.ref}>
                [{citation.ref}]{" "}
                <Link href={`/spaces/${spaceId}/sources/${citation.sourceId}`}>
                  {citation.sourceTitle}
                </Link>{" "}
                · versión {citation.versionNumber} · {citation.location}
                {citation.fromStepSources ? "" : " · otra fuente del espacio"}
              </li>
            ))}
          </ol>
        </section>
      ) : state.kind !== "idle" && messages[state.kind] ? (
        <p
          className={state.kind === "retrieval_only" ? "notice" : "error"}
          role="status"
        >
          {messages[state.kind]}
        </p>
      ) : null}

      {state.kind !== "answered" && fragments.length > 0 ? (
        <details className="assistant-fragments">
          <summary>Fragmentos recuperados ({fragments.length})</summary>
          <ol>
            {fragments.map((fragment) => (
              <li key={`${fragment.versionId}:${fragment.ordinal}`}>
                <p className="muted">
                  [{fragment.ref}] {fragment.sourceTitle} · versión{" "}
                  {fragment.versionNumber}
                </p>
                <pre>{fragment.content}</pre>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
