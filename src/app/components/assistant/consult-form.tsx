"use client";

import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { budgetMessages } from "@/app/ai-budget-messages";
import { Icon } from "@/app/components/icons";
import { Presence, SwapTransition } from "@/app/components/motion";
import { SafeMarkdown } from "@/app/components/safe-markdown";
import type { AssistantState } from "@/app/spaces/[spaceId]/assistant/actions";
import type { StepHelpState } from "@/app/spaces/[spaceId]/routes/[routeId]/learn/actions";
import { assistantLimits } from "@/modules/knowledge/contract";

import {
  useAssistant,
  type ConsultScope,
  type ConsultSession,
} from "./session";

/** Fixed examples: choosing one only fills the field, nothing is sent. */
const examples = [
  "¿Qué pasos sigue una revisión de código?",
  "¿Cómo se publica un cambio en producción?",
  "¿Qué convenciones usamos para nombrar ramas?",
];

type Outcome = {
  tone: "warning" | "danger" | "info";
  title: string;
  body: string;
};

const sharedOutcomes: Record<string, Outcome> = {
  unverifiable: {
    tone: "warning",
    title:
      "La respuesta no se pudo verificar contra las fuentes, así que no se muestra.",
    body: "Puedes reformular la pregunta y enviarla de nuevo.",
  },
  model_error: {
    tone: "danger",
    title: "No fue posible obtener respuesta del modelo.",
    body: "Tu pregunta sigue en el campo; envíala de nuevo cuando quieras.",
  },
  retrieval_only: {
    tone: "info",
    title: "El modelo de conversación no está configurado.",
    body: "Se muestran solo los fragmentos encontrados en las fuentes.",
  },
  authentication_required: {
    tone: "danger",
    title: "Tu sesión terminó.",
    body: "Inicia sesión de nuevo; tu pregunta sigue en el campo.",
  },
};

const outcomesByScope: Record<ConsultScope, Record<string, Outcome>> = {
  espacio: {
    ...sharedOutcomes,
    insufficient: {
      tone: "warning",
      title:
        "No encontré información suficiente en las fuentes vigentes del espacio para responder.",
      body: "Prueba con los términos que usa la documentación o revisa las fuentes disponibles.",
    },
    unauthorized: {
      tone: "danger",
      title: "No tienes acceso a las fuentes de este espacio.",
      body: "Pide a un responsable que revise tu acceso.",
    },
  },
  paso: {
    ...sharedOutcomes,
    insufficient: {
      tone: "warning",
      title:
        "No encontré información suficiente en las fuentes vigentes del espacio para ayudarte con este paso.",
      body: "Prueba a concretar tu duda o repasa la lección y sus fuentes.",
    },
    unauthorized: {
      tone: "danger",
      title: "No tienes acceso a esta ruta o a las fuentes del espacio.",
      body: "Pide a un responsable que revise tu acceso.",
    },
    not_found: {
      tone: "danger",
      title: "No se encontró el paso.",
      body: "Vuelve a abrir la ruta.",
    },
    not_started: {
      tone: "info",
      title: "Primero empieza la ruta.",
      body: "La ayuda está disponible en los pasos que ya puedes ver.",
    },
    locked: {
      tone: "info",
      title: "Este paso todavía está bloqueado.",
      body: "Resuelve los pasos anteriores para desbloquearlo.",
    },
  },
};

type ConsultState = AssistantState | StepHelpState;
type CitationItem = {
  ref: number;
  sourceId: string;
  sourceTitle: string;
  versionNumber: number;
  location: string;
  fromStepSources?: boolean;
};

/**
 * The assistant's form, states, citations and rendering, shared by the
 * Asistente page and the floating panel, for questions about the space or
 * help with the current step. Each query is independent: nothing here
 * remembers earlier questions.
 */
export function ConsultForm({
  scope,
  variant,
}: {
  scope: ConsultScope;
  variant: "page" | "panel";
}) {
  const assistant = useAssistant();
  const { spaceId, step } = assistant;
  const session: ConsultSession<ConsultState> =
    scope === "paso" ? assistant.help : assistant.space;
  const { state, formAction, pending, question, setQuestion } = session;
  const id = useId();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const [tooShort, setTooShort] = useState(false);
  const [seenCount, setSeenCount] = useState(session.resultCount);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const outcomes = outcomesByScope[scope];
  const help = scope === "paso";
  const minChars = assistantLimits.questionMinChars;
  const maxChars = assistantLimits.questionMaxChars;

  // A new result resets the copy and validation messages.
  if (session.resultCount !== seenCount) {
    setSeenCount(session.resultCount);
    setCopy("idle");
    setTooShort(false);
  }
  // Move focus only for a result that arrives while this form is shown,
  // never for the one already there when the panel opens.
  const focusedCount = useRef(session.resultCount);
  useEffect(() => {
    if (session.resultCount === focusedCount.current) return;
    focusedCount.current = session.resultCount;
    if (state.kind === "invalid_question") fieldRef.current?.focus();
    else if (state.kind !== "idle") resultRef.current?.focus();
  }, [session.resultCount, state.kind]);

  // Grow with the text up to the CSS max-height.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight + 2}px`;
  }, [question]);

  const fillField = (value: string) => {
    setQuestion(value);
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    requestAnimationFrame(() =>
      field.setSelectionRange(value.length, value.length),
    );
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // One query at a time: ignore a second submit while one is running.
    if (pending) {
      event.preventDefault();
      return;
    }
    const length = question.trim().length;
    // Checked here, in Spanish; help also accepts an empty doubt.
    if ((length < minChars && !(help && length === 0)) || length > maxChars) {
      event.preventDefault();
      setTooShort(true);
      fieldRef.current?.focus();
      return;
    }
    session.markSubmitted(question.trim());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (!pending) event.currentTarget.form?.requestSubmit();
    }
  };

  const visible = session.resultVisible;
  const shown: ConsultState = visible ? state : { kind: "idle" };
  const citations: CitationItem[] =
    shown.kind === "answered" ? shown.citations : [];
  const citesStepCode =
    shown.kind === "answered" && "citesStepCode" in shown
      ? shown.citesStepCode
      : false;

  const copyAnswer = async () => {
    if (shown.kind !== "answered") return;
    const text = [
      shown.answer,
      "",
      "Fuentes:",
      ...(citesStepCode ? ["[código] Código del paso"] : []),
      ...citations.map(
        (citation) =>
          `[${citation.ref}] ${citation.sourceTitle}, versión ${citation.versionNumber}, ${citation.location}`,
      ),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  const invalid = tooShort || shown.kind === "invalid_question";
  const length = question.trim().length;
  const fragments = "fragments" in shown ? shown.fragments : [];
  const askedQuestion = "question" in shown ? shown.question.trim() : "";
  const anchorId = (ref: number) => `${id}-cita-${ref}`;
  const anchors = new Map(
    citations.map((citation) => [citation.ref, anchorId(citation.ref)]),
  );
  const sourcesChanged =
    "sourcesChanged" in shown ? shown.sourcesChanged : false;
  const helpMode = "mode" in shown ? shown.mode : null;

  return (
    <div className={`assistant is-${variant}`}>
      {help ? (
        <p className="muted consult-intro">
          {step?.resolved
            ? "El asistente puede explicarte la respuesta con apoyo en las fuentes."
            : "El asistente explica conceptos y te orienta hacia las fuentes sin elegir la opción por ti. Aun así, su ayuda puede dejar ver la respuesta."}{" "}
          No consume intentos de respuesta. Cada consulta usa IA y cuenta en tu
          límite diario de consultas.
        </p>
      ) : (
        <Presence show={shown.kind === "idle" && !pending}>
          <section
            aria-labelledby={`${id}-examples`}
            className="assistant-welcome"
          >
            <h2 id={`${id}-examples`}>¿Qué necesitas saber?</h2>
            <p className="muted">
              Elige un ejemplo para editarlo o escribe tu propia pregunta. Nada
              se envía hasta que pulses Preguntar.
            </p>
            <ul className="example-list">
              {examples.map((example) => (
                <li key={example}>
                  <button
                    className="example-chip"
                    onClick={() => fillField(example)}
                    type="button"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </Presence>
      )}

      <form
        action={formAction}
        className="composer-form"
        noValidate
        onSubmit={onSubmit}
      >
        <input name="spaceId" type="hidden" value={spaceId} />
        {help && step ? (
          <>
            <input name="routeId" type="hidden" value={step.routeId} />
            <input name="stepId" type="hidden" value={step.stepId} />
          </>
        ) : null}
        <label
          className={help ? "consult-label" : "sr-only"}
          htmlFor={`${id}-question`}
        >
          {help ? "Tu duda (opcional)" : "Pregunta"}
        </label>
        <div className={`composer${invalid ? " is-invalid" : ""}`}>
          <textarea
            aria-describedby={`${id}-hint${invalid ? ` ${id}-invalid` : ""}`}
            aria-invalid={invalid || undefined}
            id={`${id}-question`}
            maxLength={maxChars}
            name="question"
            onChange={(event) => {
              setQuestion(event.target.value);
              setTooShort(false);
            }}
            onKeyDown={onKeyDown}
            placeholder={
              help
                ? step?.resolved
                  ? "Por ejemplo: ¿por qué mi primera respuesta no era correcta?"
                  : "Por ejemplo: ¿qué significa este concepto en la lección?"
                : "Escribe tu pregunta"
            }
            readOnly={pending}
            ref={fieldRef}
            rows={2}
            value={question}
          />
          <div className="composer-bar">
            <p className="composer-hint" id={`${id}-hint`}>
              <span className="composer-shortcut">
                Ctrl + Enter para enviar ·{" "}
              </span>
              {length} / {maxChars}
            </p>
            <button
              aria-busy={pending || undefined}
              disabled={pending}
              type="submit"
            >
              {pending ? (
                <span aria-hidden="true" className="spinner" />
              ) : (
                <Icon name="arrowRight" size={18} />
              )}
              {pending ? "Consultando…" : "Preguntar"}
            </button>
          </div>
        </div>
        <Presence show={invalid}>
          <p className="field-error" id={`${id}-invalid`}>
            {help
              ? `Escribe una duda de ${minChars} a ${maxChars} caracteres o déjala vacía.`
              : `Escribe una pregunta de ${minChars} a ${maxChars} caracteres.`}
          </p>
        </Presence>
      </form>

      <div aria-live="polite" className="sr-only">
        {pending ? "Consultando las fuentes…" : ""}
      </div>

      <SwapTransition
        swapKey={
          pending
            ? `consultando-${session.resultCount}`
            : `resultado-${session.resultCount}-${visible}`
        }
      >
        {pending ? (
          <div className="assistant-result">
            {session.pendingQuestion ? (
              <QuestionCard question={session.pendingQuestion} />
            ) : null}
            <div className="assistant-loading">
              <span aria-hidden="true" className="spinner" />
              Buscando en las fuentes y redactando la respuesta…
            </div>
          </div>
        ) : shown.kind !== "idle" && shown.kind !== "invalid_question" ? (
          <div
            aria-labelledby={`${id}-result-title`}
            className="assistant-result"
            ref={(element) => {
              // A previous result leaves after this one mounts.
              if (element) resultRef.current = element;
              return () => {
                if (resultRef.current === element) resultRef.current = null;
              };
            }}
            role="group"
            tabIndex={-1}
          >
            <h2 className="sr-only" id={`${id}-result-title`}>
              Resultado de la consulta
            </h2>
            {askedQuestion ? (
              <QuestionCard
                onEdit={
                  shown.kind === "answered"
                    ? () => fillField(askedQuestion)
                    : undefined
                }
                question={askedQuestion}
              />
            ) : null}

            {sourcesChanged ? (
              <p className="callout" role="status">
                <Icon name="alert" size={18} />
                Alguna fuente de este paso cambió o se eliminó después de
                publicar la ruta. La ayuda usa las versiones vigentes, que
                pueden no coincidir con la lección.
              </p>
            ) : null}

            {shown.kind === "answered" ? (
              <section aria-label="Respuesta" className="answer-card">
                <p className="answer-label">
                  <Icon name="spark" size={16} />
                  {helpMode === "pistas"
                    ? "Ayuda para comprender"
                    : helpMode
                      ? "Explicación"
                      : "Respuesta según las fuentes"}
                </p>
                <SafeMarkdown citationAnchors={anchors} text={shown.answer} />
                <h3 className="answer-sources-title">
                  Fuentes citadas ({citations.length + (citesStepCode ? 1 : 0)})
                </h3>
                <ol className="answer-sources">
                  {citesStepCode ? (
                    <li>
                      <span aria-hidden="true" className="cite-number">
                        &lt;/&gt;
                      </span>
                      <span>
                        <strong>Código del paso</strong>
                        <span className="muted">
                          Describe lo que hace el código mostrado, no una
                          práctica de la empresa.
                        </span>
                      </span>
                    </li>
                  ) : null}
                  {citations.map((citation) => (
                    <li
                      id={anchorId(citation.ref)}
                      key={citation.ref}
                      tabIndex={-1}
                    >
                      <span aria-hidden="true" className="cite-number">
                        {citation.ref}
                      </span>
                      <span>
                        <Link
                          href={`/spaces/${spaceId}/sources/${citation.sourceId}`}
                        >
                          {citation.sourceTitle}
                        </Link>
                        <span className="muted">
                          Versión {citation.versionNumber} · {citation.location}
                          {citation.fromStepSources === false
                            ? " · otra fuente del espacio"
                            : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="answer-actions">
                  <button
                    className="ghost small"
                    onClick={copyAnswer}
                    type="button"
                  >
                    <Icon
                      name={copy === "copied" ? "check" : "copy"}
                      size={16}
                    />
                    {copy === "copied" ? "Copiada" : "Copiar respuesta"}
                  </button>
                  <span aria-live="polite" className="muted">
                    {copy === "copied"
                      ? "Respuesta y fuentes copiadas al portapapeles."
                      : copy === "failed"
                        ? "No se pudo copiar. Selecciona el texto y cópialo a mano."
                        : ""}
                  </span>
                </div>
                <p className="answer-note muted">
                  Generada con IA a partir de las fuentes citadas. Revisa la
                  fuente antes de aplicar una práctica.
                </p>
              </section>
            ) : shown.kind === "budget_exceeded" ? (
              <OutcomeNotice
                outcome={{
                  tone: "warning",
                  title: "Límite de consumo alcanzado",
                  body: budgetMessages[shown.limit],
                }}
              />
            ) : outcomes[shown.kind] ? (
              <OutcomeNotice outcome={outcomes[shown.kind]}>
                {shown.kind === "insufficient" && !help ? (
                  <Link href={`/spaces/${spaceId}/sources`}>
                    Ver las fuentes
                  </Link>
                ) : shown.kind === "authentication_required" ? (
                  <Link
                    href={`/login?next=${encodeURIComponent(`/spaces/${spaceId}`)}`}
                  >
                    Iniciar sesión
                  </Link>
                ) : null}
              </OutcomeNotice>
            ) : null}

            {fragments.length > 0 ? (
              <details
                className="assistant-fragments"
                open={shown.kind === "retrieval_only"}
              >
                <summary>
                  {shown.kind === "answered"
                    ? "Fragmentos consultados"
                    : "Fragmentos encontrados"}{" "}
                  ({fragments.length})
                </summary>
                <ol>
                  {fragments.map((fragment) => (
                    <li key={`${fragment.versionId}:${fragment.ordinal}`}>
                      <p className="fragment-meta">
                        [{fragment.ref}] {fragment.sourceTitle} · versión{" "}
                        {fragment.versionNumber} ·{" "}
                        {fragment.pageNumber !== null
                          ? `Página ${fragment.pageNumber}`
                          : `líneas ${fragment.startLine}–${fragment.endLine}`}
                      </p>
                      <SafeMarkdown
                        className="markdown is-compact"
                        text={fragment.content}
                      />
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </div>
        ) : null}
      </SwapTransition>
    </div>
  );
}

function QuestionCard({
  question,
  onEdit,
}: {
  question: string;
  onEdit?: () => void;
}) {
  return (
    <div className="question-card">
      <p className="answer-label">Tu pregunta</p>
      <p className="question-text">{question}</p>
      {onEdit ? (
        <button className="ghost small" onClick={onEdit} type="button">
          Editar esta pregunta
        </button>
      ) : null}
    </div>
  );
}

function OutcomeNotice({
  outcome,
  children,
}: {
  outcome: Outcome;
  children?: ReactNode;
}) {
  return (
    <div className={`outcome is-${outcome.tone}`}>
      <Icon name={outcome.tone === "info" ? "help" : "alert"} size={20} />
      <div>
        <p className="outcome-title">{outcome.title}</p>
        <p>{outcome.body}</p>
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}
