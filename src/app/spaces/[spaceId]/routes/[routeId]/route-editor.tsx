"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { Icon, type IconName } from "@/app/components/icons";
import { Presence, SwapTransition } from "@/app/components/motion";
import {
  codeHoleMarker,
  type RouteCitation,
  type RouteStep,
} from "@/modules/routes/contract";

import {
  deleteStepAction,
  moveStepAction,
  publishRouteAction,
  regenerateRouteAction,
  saveStepFormAction,
  type SaveStepState,
} from "../actions";
import { CodeBlock } from "../code-block";
import { citationStateLabels, routeErrorMessages } from "../messages";

type Kind = "opcion_multiple" | "lectura_codigo" | "completar";

/** Everything typed in a step, whatever its activity, until it is saved. */
type Draft = {
  title: string;
  lesson: string;
  kind: Kind;
  code: string;
  codeLanguage: string;
  codeOrigin: "fuente" | "ilustrativo";
  question: string;
  options: string[];
  correctOption: number;
  acceptedAnswers: string[];
  explanation: string;
};

const kinds: { key: Kind; label: string; icon: IconName; help: string }[] = [
  {
    key: "opcion_multiple",
    label: "Opción múltiple",
    icon: "check",
    help: "Pregunta con 3 o 4 opciones.",
  },
  {
    key: "lectura_codigo",
    label: "Lectura de código",
    icon: "book",
    help: "Código de solo lectura y pregunta con opciones.",
  },
  {
    key: "completar",
    label: "Completar código",
    icon: "sources",
    help: "Código con un hueco y respuestas exactas.",
  },
];

const kindLabel = (kind: Kind) =>
  kinds.find((item) => item.key === kind)?.label ?? kind;
const letter = (index: number) => String.fromCharCode(65 + index);

function fromStep(step: RouteStep): Draft {
  const kind: Kind =
    step.activityType === "completar"
      ? "completar"
      : step.code
        ? "lectura_codigo"
        : "opcion_multiple";
  return {
    title: step.title,
    lesson: step.lesson,
    kind,
    code: step.code?.content ?? "",
    codeLanguage: step.code?.language ?? "",
    codeOrigin: step.code?.origin ?? "ilustrativo",
    question: step.question,
    options: [...step.options, "", "", "", ""].slice(0, 4),
    correctOption: step.correctOption ?? 0,
    acceptedAnswers:
      step.acceptedAnswers && step.acceptedAnswers.length > 0
        ? step.acceptedAnswers
        : [""],
    explanation: step.explanation ?? "",
  };
}

/** What would be saved, so unused fields of another activity never count. */
function saved(draft: Draft) {
  const usesCode = draft.kind !== "opcion_multiple";
  const usesOptions = draft.kind !== "completar";
  return JSON.stringify({
    title: draft.title,
    lesson: draft.lesson,
    kind: draft.kind,
    code: usesCode ? draft.code : "",
    codeLanguage: usesCode ? draft.codeLanguage : "",
    codeOrigin: usesCode ? draft.codeOrigin : "",
    question: draft.question,
    options: usesOptions ? draft.options : [],
    correctOption: usesOptions ? draft.correctOption : null,
    acceptedAnswers: usesOptions
      ? []
      : draft.acceptedAnswers.map((answer) => answer.trim()).filter(Boolean),
    explanation: draft.explanation,
  });
}

const saveMessages: Record<string, string> = {
  ok: "Paso guardado.",
  invalid: routeErrorMessages.invalid,
  conflict: routeErrorMessages.conflict,
  not_editable: routeErrorMessages.not_editable,
};

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {help ? (
        <p className="field-help" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

function Citations({
  spaceId,
  citations,
}: {
  spaceId: string;
  citations: RouteCitation[];
}) {
  return (
    <details className="citations">
      <summary>
        <Icon name="sources" size={16} />
        Fuentes citadas ({citations.length})
        {citations.some((citation) => citation.state !== "vigente") ? (
          <span className="badge warning">Revisar</span>
        ) : null}
      </summary>
      <ul>
        {citations.map((citation) => (
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
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Preview({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const usesCode = draft.kind !== "opcion_multiple" && draft.code.trim();
  return (
    <div className="preview">
      <div className="preview-header">
        <p className="eyebrow">Vista previa del integrante</p>
        <button className="icon-button" onClick={onClose} type="button">
          <Icon name="close" />
          <span className="sr-only">Cerrar vista previa</span>
        </button>
      </div>
      <h2>{draft.title || "Paso sin título"}</h2>
      <p className="answer-text">{draft.lesson}</p>
      {usesCode ? (
        <CodeBlock
          code={{
            content: draft.code,
            language: draft.codeLanguage.trim() || null,
            origin: draft.codeOrigin,
          }}
        />
      ) : null}
      <p>
        <strong>Pregunta:</strong> {draft.question}
      </p>
      {draft.kind === "completar" ? (
        <label className="preview-answer">
          Texto para el hueco
          <input autoComplete="off" className="code-input" />
        </label>
      ) : (
        <fieldset className="preview-options">
          <legend>Elige una opción</legend>
          {draft.options.map((option, index) =>
            option.trim() ? (
              <label className="checkbox" key={index}>
                <input name="preview-option" type="radio" />
                {letter(index)}. {option}
              </label>
            ) : null,
          )}
        </fieldset>
      )}
      <button disabled type="button">
        Responder
      </button>
      <p className="field-help">
        Así lo verá quien recorra la ruta. La vista previa no muestra la
        respuesta correcta ni registra respuestas, intentos o progreso.
      </p>
    </div>
  );
}

export function RouteEditor({
  spaceId,
  routeId,
  editVersion,
  steps,
  initialStepId,
}: {
  spaceId: string;
  routeId: string;
  editVersion: number;
  steps: RouteStep[];
  initialStepId: string | null;
}) {
  const [currentId, setCurrentId] = useState(
    steps.find((step) => step.id === initialStepId)?.id ?? steps[0]?.id,
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [confirmingSwitch, setConfirmingSwitch] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [state, formAction, saving] = useActionState<SaveStepState, FormData>(
    saveStepFormAction,
    { kind: "idle", stepId: null, at: 0 },
  );
  const [handledAt, setHandledAt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const switchDialog = useRef<HTMLDialogElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);

  const step = steps.find((item) => item.id === currentId) ?? steps[0];
  const draft = drafts[step.id] ?? fromStep(step);
  const isDirty = (item: RouteStep) =>
    Boolean(drafts[item.id]) &&
    saved(drafts[item.id]) !== saved(fromStep(item));
  const dirty = isDirty(step);
  const anyDirty = steps.some(isDirty);

  // A finished save: a saved step drops its draft (the page data is fresh),
  // and a pending step change happens now. Errors keep everything typed.
  if (state.at !== handledAt) {
    setHandledAt(state.at);
    if (state.kind === "ok" && state.stepId) {
      const savedId = state.stepId;
      setDrafts((current) => {
        const next = { ...current };
        delete next[savedId];
        return next;
      });
      if (pendingTarget) setCurrentId(pendingTarget);
    }
    setPendingTarget(null);
  }

  useEffect(() => {
    if (!anyDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    // In-app links would drop unsaved text without asking.
    const guardLinks = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (
        link &&
        !link.closest(".editor") &&
        !window.confirm(
          "Hay cambios sin guardar en este borrador. ¿Salir sin guardarlos?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLinks, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLinks, true);
    };
  }, [anyDirty]);

  useEffect(() => {
    const dialog = switchDialog.current;
    if (confirmingSwitch && dialog && !dialog.open) dialog.showModal();
    if (!confirmingSwitch && dialog?.open) dialog.close();
  }, [confirmingSwitch]);

  useEffect(() => {
    const dialog = previewDialog.current;
    if (previewing && dialog && !dialog.open) dialog.showModal();
    if (!previewing && dialog?.open) dialog.close();
  }, [previewing]);

  const update = (changes: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [step.id]: { ...(current[step.id] ?? fromStep(step)), ...changes },
    }));

  const requestSwitch = (target: string) => {
    if (target === step.id) return;
    if (dirty) setConfirmingSwitch(target);
    else setCurrentId(target);
  };

  const holes = draft.code.split(codeHoleMarker).length - 1;
  const answers = draft.acceptedAnswers;
  const hidden = {
    code: draft.kind === "opcion_multiple" ? "" : draft.code,
    acceptedAnswers:
      draft.kind === "completar"
        ? answers
            .map((answer) => answer.trim())
            .filter(Boolean)
            .join("\n")
        : "",
  };
  const unusedNote =
    draft.kind === "opcion_multiple" && draft.code.trim()
      ? "El código escrito no se guardará como Opción múltiple; sigue aquí si vuelves a otro tipo."
      : draft.kind === "completar" &&
          draft.options.some((option) => option.trim())
        ? "Las opciones escritas no se guardarán como Completar código; siguen aquí si vuelves a otro tipo."
        : draft.kind !== "completar" && answers.some((answer) => answer.trim())
          ? "Las respuestas aceptadas no se guardarán con este tipo; siguen aquí si vuelves a Completar código."
          : null;
  const result =
    state.stepId === step.id && state.kind !== "idle"
      ? saveMessages[state.kind]
      : null;
  const id = (name: string) => `${name}-${step.id}`;
  const routeFields = (
    <>
      <input name="spaceId" type="hidden" value={spaceId} />
      <input name="routeId" type="hidden" value={routeId} />
      <input name="editVersion" type="hidden" value={editVersion} />
    </>
  );

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <p className="muted" role="status">
          {anyDirty
            ? "Hay pasos con cambios sin guardar."
            : "Todos los cambios están guardados."}
        </p>
        <div className="actions compact">
          <form action={regenerateRouteAction} className="inline-form">
            {routeFields}
            <ConfirmSubmitButton
              className="secondary"
              disabled={anyDirty}
              confirmLabel="Regenerar"
              message="¿Regenerar? Reemplaza el borrador actual y cuenta como un intento del límite diario."
            >
              Regenerar borrador
            </ConfirmSubmitButton>
          </form>
          <form action={publishRouteAction} className="inline-form">
            {routeFields}
            <ConfirmSubmitButton
              disabled={anyDirty}
              confirmLabel="Publicar"
              message="¿Publicar esta ruta? La versión publicada no se podrá editar."
              title={
                anyDirty
                  ? "Guarda o descarta los cambios antes de publicar"
                  : undefined
              }
            >
              Publicar ruta
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      <div className="editor-layout">
        <nav aria-label="Pasos del borrador" className="step-index">
          <ol>
            {steps.map((item) => (
              <li key={item.id}>
                <button
                  aria-current={item.id === step.id ? "step" : undefined}
                  className="step-index-item"
                  onClick={() => requestSwitch(item.id)}
                  type="button"
                >
                  <span className="step-index-number">{item.position}</span>
                  <span className="step-index-text">
                    <span className="step-index-title">
                      {drafts[item.id]?.title || item.title}
                    </span>
                    <span className="step-index-kind">
                      {kindLabel((drafts[item.id] ?? fromStep(item)).kind)}
                    </span>
                  </span>
                  {isDirty(item) ? (
                    <span className="dirty-dot" title="Cambios sin guardar">
                      <span className="sr-only">Cambios sin guardar</span>
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="step-picker">
          <label htmlFor="step-picker">Paso</label>
          <select
            id="step-picker"
            onChange={(event) => requestSwitch(event.target.value)}
            value={step.id}
          >
            {steps.map((item) => (
              <option key={item.id} value={item.id}>
                {item.position}. {drafts[item.id]?.title || item.title}
                {isDirty(item) ? " (sin guardar)" : ""}
              </option>
            ))}
          </select>
        </div>

        <SwapTransition order={step.position} swapKey={step.id}>
          <section aria-label={`Paso ${step.position}`} className="step-editor">
            <header className="step-editor-header">
              <div>
                <p className="eyebrow">
                  Paso {step.position} de {steps.length}
                </p>
                <h2>{draft.title || "Paso sin título"}</h2>
              </div>
              <div className="step-editor-actions">
                {dirty ? (
                  <span className="badge warning">Cambios sin guardar</span>
                ) : result === saveMessages.ok ? (
                  <span className="badge success">
                    <Icon name="check" size={14} />
                    Guardado
                  </span>
                ) : null}
                <button
                  className="secondary"
                  onClick={() => setPreviewing(true)}
                  type="button"
                >
                  Vista previa
                </button>
                <button
                  disabled={saving || !dirty}
                  form={`step-form-${step.id}`}
                  type="submit"
                >
                  {saving ? (
                    <span aria-hidden="true" className="spinner" />
                  ) : null}
                  Guardar paso
                </button>
              </div>
            </header>

            {result && result !== saveMessages.ok ? (
              <p className="error" role="alert">
                <Icon name="alert" size={18} />
                {result}
              </p>
            ) : null}

            <form
              action={formAction}
              className="step-form"
              id={`step-form-${step.id}`}
              ref={(element) => {
                // The previous step's form leaves after the new one mounts:
                // only clear the ref if it still points to this form.
                if (element) formRef.current = element;
                return () => {
                  if (formRef.current === element) formRef.current = null;
                };
              }}
            >
              {routeFields}
              <input name="stepId" type="hidden" value={step.id} />
              <input name="title" type="hidden" value={draft.title} />
              <input name="lesson" type="hidden" value={draft.lesson} />
              <input name="question" type="hidden" value={draft.question} />
              <input
                name="explanation"
                type="hidden"
                value={draft.explanation}
              />
              <input
                name="activityType"
                type="hidden"
                value={
                  draft.kind === "completar" ? "completar" : "opcion_multiple"
                }
              />
              <input name="code" type="hidden" value={hidden.code} />
              <input
                name="codeLanguage"
                type="hidden"
                value={draft.codeLanguage}
              />
              <input name="codeOrigin" type="hidden" value={draft.codeOrigin} />
              {draft.kind !== "completar"
                ? draft.options.map((option, index) => (
                    <input
                      key={index}
                      name={`option${index}`}
                      type="hidden"
                      value={option}
                    />
                  ))
                : null}
              <input
                name="correctOption"
                type="hidden"
                value={draft.correctOption}
              />
              <input
                name="acceptedAnswers"
                type="hidden"
                value={hidden.acceptedAnswers}
              />
            </form>

            <div className="editor-section">
              <h3>Contenido</h3>
              <Field id={id("title")} label="Título">
                <input
                  id={id("title")}
                  maxLength={120}
                  onChange={(event) => update({ title: event.target.value })}
                  value={draft.title}
                />
              </Field>
              <Field
                help="Cita las fuentes con [n], según la lista de fuentes citadas."
                id={id("lesson")}
                label="Lección"
              >
                <textarea
                  aria-describedby={`${id("lesson")}-help`}
                  id={id("lesson")}
                  onChange={(event) => update({ lesson: event.target.value })}
                  rows={5}
                  value={draft.lesson}
                />
              </Field>
              <Citations citations={step.citations} spaceId={spaceId} />
            </div>

            <div className="editor-section">
              <h3>Actividad</h3>
              <fieldset className="kind-picker">
                <legend className="sr-only">Tipo de actividad</legend>
                {kinds.map((kind) => (
                  <label className="kind-option" key={kind.key}>
                    <input
                      checked={draft.kind === kind.key}
                      className="sr-only"
                      name={`kind-${step.id}`}
                      onChange={() => update({ kind: kind.key })}
                      type="radio"
                    />
                    <Icon name={kind.icon} size={18} />
                    <span>
                      <strong>{kind.label}</strong>
                      <span className="muted">{kind.help}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <Presence show={Boolean(unusedNote)}>
                <p className="callout" role="status">
                  <Icon name="alert" size={18} />
                  {unusedNote}
                </p>
              </Presence>

              <SwapTransition swapKey={draft.kind}>
                <div className="activity-fields">
                  {draft.kind !== "opcion_multiple" ? (
                    <>
                      <Field
                        help={
                          draft.kind === "completar" ? (
                            <>
                              Marca con <code>{codeHoleMarker}</code> el único
                              fragmento que se debe completar.{" "}
                              {holes === 1
                                ? "Hay un hueco."
                                : `Ahora hay ${holes} huecos.`}
                            </>
                          ) : (
                            "Se muestra como texto; nunca se ejecuta."
                          )
                        }
                        id={id("code")}
                        label={
                          draft.kind === "completar"
                            ? "Código con hueco"
                            : "Código"
                        }
                      >
                        <textarea
                          aria-describedby={`${id("code")}-help`}
                          className="code-input"
                          id={id("code")}
                          maxLength={3000}
                          onChange={(event) =>
                            update({ code: event.target.value })
                          }
                          rows={8}
                          spellCheck={false}
                          value={draft.code}
                          wrap="off"
                        />
                      </Field>
                      <div className="field-row">
                        <Field
                          help="Opcional, por ejemplo typescript."
                          id={id("language")}
                          label="Lenguaje"
                        >
                          <input
                            id={id("language")}
                            maxLength={30}
                            onChange={(event) =>
                              update({ codeLanguage: event.target.value })
                            }
                            value={draft.codeLanguage}
                          />
                        </Field>
                        <Field
                          help="«Fuente» solo si es una copia literal de una fuente citada."
                          id={id("origin")}
                          label="Origen"
                        >
                          <select
                            id={id("origin")}
                            onChange={(event) =>
                              update({
                                codeOrigin:
                                  event.target.value === "fuente"
                                    ? "fuente"
                                    : "ilustrativo",
                              })
                            }
                            value={draft.codeOrigin}
                          >
                            <option value="ilustrativo">
                              Ejemplo ilustrativo
                            </option>
                            <option value="fuente">Copiado de la fuente</option>
                          </select>
                        </Field>
                      </div>
                    </>
                  ) : null}

                  <Field id={id("question")} label="Pregunta">
                    <input
                      id={id("question")}
                      maxLength={400}
                      onChange={(event) =>
                        update({ question: event.target.value })
                      }
                      value={draft.question}
                    />
                  </Field>

                  {draft.kind !== "completar" ? (
                    <fieldset className="option-list">
                      <legend>Opciones · marca la correcta</legend>
                      {draft.options.map((option, index) => (
                        <div
                          className={`option-row${draft.correctOption === index ? " is-correct" : ""}`}
                          key={index}
                        >
                          <label className="option-correct">
                            <input
                              checked={draft.correctOption === index}
                              name={`correct-${step.id}`}
                              onChange={() => update({ correctOption: index })}
                              type="radio"
                            />
                            <span className="sr-only">
                              Marcar la opción {letter(index)} como correcta
                            </span>
                          </label>
                          <label
                            className="sr-only"
                            htmlFor={id(`option-${index}`)}
                          >
                            Opción {letter(index)}
                          </label>
                          <span aria-hidden="true" className="option-letter">
                            {letter(index)}
                          </span>
                          <input
                            id={id(`option-${index}`)}
                            maxLength={200}
                            onChange={(event) =>
                              update({
                                options: draft.options.map((item, position) =>
                                  position === index
                                    ? event.target.value
                                    : item,
                                ),
                              })
                            }
                            placeholder={index === 3 ? "Opcional" : undefined}
                            value={option}
                          />
                          {draft.correctOption === index ? (
                            <span className="badge success">Correcta</span>
                          ) : null}
                        </div>
                      ))}
                      {!draft.options[draft.correctOption]?.trim() ? (
                        <p className="field-help warning-text">
                          La opción marcada como correcta está vacía.
                        </p>
                      ) : null}
                    </fieldset>
                  ) : (
                    <fieldset className="answer-list">
                      <legend>Respuestas aceptadas</legend>
                      {answers.map((answer, index) => (
                        <div className="answer-row" key={index}>
                          <label
                            className="sr-only"
                            htmlFor={id(`answer-${index}`)}
                          >
                            {index === 0
                              ? "Respuesta principal"
                              : `Variante ${index}`}
                          </label>
                          <input
                            className="code-input"
                            id={id(`answer-${index}`)}
                            maxLength={200}
                            onChange={(event) =>
                              update({
                                acceptedAnswers: answers.map(
                                  (item, position) =>
                                    position === index
                                      ? event.target.value
                                      : item,
                                ),
                              })
                            }
                            spellCheck={false}
                            value={answer}
                          />
                          {index === 0 ? (
                            <span className="badge brand">Principal</span>
                          ) : (
                            <button
                              className="ghost small"
                              onClick={() =>
                                update({
                                  acceptedAnswers: answers.filter(
                                    (_, position) => position !== index,
                                  ),
                                })
                              }
                              type="button"
                            >
                              Quitar
                              <span className="sr-only"> variante {index}</span>
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        className="secondary small"
                        disabled={answers.length >= 5}
                        onClick={() =>
                          update({ acceptedAnswers: [...answers, ""] })
                        }
                        type="button"
                      >
                        <Icon name="plus" size={16} />
                        Añadir variante
                      </button>
                      <p className="field-help">
                        Se comparan exactas: cuentan mayúsculas, espacios
                        internos y signos. Hasta 5 en total.
                      </p>
                    </fieldset>
                  )}
                </div>
              </SwapTransition>
            </div>

            <div className="editor-section">
              <h3>Explicación de la respuesta</h3>
              <Field
                help="Se muestra cuando la persona resuelve el paso."
                id={id("explanation")}
                label="Explicación"
              >
                <textarea
                  aria-describedby={`${id("explanation")}-help`}
                  id={id("explanation")}
                  onChange={(event) =>
                    update({ explanation: event.target.value })
                  }
                  rows={3}
                  value={draft.explanation}
                />
              </Field>
            </div>

            <footer className="step-editor-footer">
              <span className="muted">
                {dirty
                  ? "Guarda o descarta los cambios para mover o eliminar el paso."
                  : "Orden y eliminación"}
              </span>
              <div className="actions compact">
                {(["up", "down"] as const).map((direction) => (
                  <form
                    action={moveStepAction}
                    className="inline-form"
                    key={direction}
                  >
                    {routeFields}
                    <input name="stepId" type="hidden" value={step.id} />
                    <input name="direction" type="hidden" value={direction} />
                    <button
                      className="secondary small"
                      disabled={
                        dirty ||
                        (direction === "up"
                          ? step.position === 1
                          : step.position === steps.length)
                      }
                      type="submit"
                    >
                      {direction === "up" ? "Subir" : "Bajar"} paso{" "}
                      {step.position}
                    </button>
                  </form>
                ))}
                <form action={deleteStepAction} className="inline-form">
                  {routeFields}
                  <input name="stepId" type="hidden" value={step.id} />
                  <ConfirmSubmitButton
                    className="danger small"
                    disabled={dirty}
                    confirmLabel="Eliminar paso"
                    message={`¿Eliminar el paso ${step.position} del borrador?`}
                  >
                    Eliminar paso {step.position}
                  </ConfirmSubmitButton>
                </form>
              </div>
            </footer>
          </section>
        </SwapTransition>
      </div>

      <dialog
        aria-labelledby="switch-title"
        className="modal"
        onClose={() => setConfirmingSwitch(null)}
        ref={switchDialog}
      >
        <h2 id="switch-title">Hay cambios sin guardar</h2>
        <p>
          El paso {step.position} tiene cambios que todavía no se guardaron.
        </p>
        <div className="actions">
          <button
            onClick={() => {
              setPendingTarget(confirmingSwitch);
              setConfirmingSwitch(null);
              formRef.current?.requestSubmit();
            }}
            type="button"
          >
            Guardar y cambiar
          </button>
          <button
            className="secondary"
            onClick={() => {
              const target = confirmingSwitch;
              setDrafts((current) => {
                const next = { ...current };
                delete next[step.id];
                return next;
              });
              setConfirmingSwitch(null);
              if (target) setCurrentId(target);
            }}
            type="button"
          >
            Descartar cambios
          </button>
          <button
            className="ghost"
            onClick={() => setConfirmingSwitch(null)}
            type="button"
          >
            Seguir editando
          </button>
        </div>
      </dialog>

      <dialog
        aria-label="Vista previa del paso"
        className="modal modal-wide"
        onClose={() => setPreviewing(false)}
        ref={previewDialog}
      >
        {previewing ? (
          <Preview draft={draft} onClose={() => setPreviewing(false)} />
        ) : null}
      </dialog>
    </div>
  );
}
