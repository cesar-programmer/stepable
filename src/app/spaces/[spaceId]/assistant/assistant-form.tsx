"use client";

import Link from "next/link";
import { useActionState } from "react";

import { askAssistantAction, type AssistantState } from "./actions";

const messages: Record<string, string> = {
  insufficient:
    "No encontré información suficiente en las fuentes vigentes del espacio para responder.",
  retrieval_only:
    "El modelo de conversación no está configurado; se muestran solo los fragmentos encontrados.",
  unverifiable:
    "La respuesta del modelo no se pudo verificar contra los fragmentos recuperados y no se muestra.",
  model_error:
    "No fue posible obtener respuesta del modelo. Inténtalo de nuevo más tarde.",
  invalid_question: "Escribe una pregunta de 3 a 500 caracteres.",
  unauthorized: "No tienes acceso a las fuentes de este espacio.",
  authentication_required: "Tu sesión terminó. Inicia sesión de nuevo.",
};

export function AssistantForm({ spaceId }: { spaceId: string }) {
  const [state, formAction, pending] = useActionState<AssistantState, FormData>(
    askAssistantAction,
    { kind: "idle" },
  );

  const fragments = "fragments" in state ? state.fragments : [];

  return (
    <>
      <form action={formAction}>
        <input name="spaceId" type="hidden" value={spaceId} />
        <label>
          Pregunta
          <textarea
            defaultValue={"question" in state ? state.question : ""}
            maxLength={500}
            minLength={3}
            name="question"
            required
            rows={3}
          />
        </label>
        <button disabled={pending} type="submit">
          {pending ? "Consultando…" : "Preguntar"}
        </button>
      </form>

      {state.kind === "answered" ? (
        <section aria-label="Respuesta" className="assistant-answer">
          <p className="answer-text">{state.answer}</p>
          <h2>Citas</h2>
          <ol className="citation-list">
            {state.citations.map((citation) => (
              <li key={citation.ref}>
                [{citation.ref}]{" "}
                <Link href={`/spaces/${spaceId}/sources/${citation.sourceId}`}>
                  {citation.sourceTitle}
                </Link>{" "}
                · versión {citation.versionNumber} · {citation.location}
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

      {fragments.length > 0 ? (
        <details
          className="assistant-fragments"
          open={state.kind !== "answered"}
        >
          <summary>Fragmentos recuperados ({fragments.length})</summary>
          <ol>
            {fragments.map((fragment) => (
              <li key={`${fragment.versionId}:${fragment.ordinal}`}>
                <p className="muted">
                  [{fragment.ref}] {fragment.sourceTitle} · versión{" "}
                  {fragment.versionNumber} ·{" "}
                  {fragment.pageNumber !== null
                    ? `Página ${fragment.pageNumber}`
                    : `líneas ${fragment.startLine}–${fragment.endLine}`}
                </p>
                <pre>{fragment.content}</pre>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </>
  );
}
