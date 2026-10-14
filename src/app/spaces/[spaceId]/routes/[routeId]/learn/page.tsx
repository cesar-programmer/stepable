import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresLearningRepository } from "@/adapters/postgres/learning-repository";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { Icon, type IconName } from "@/app/components/icons";
import { SwapTransition } from "@/app/components/motion";
import { SubmitButton } from "@/app/components/submit-button";
import type { LearnerStep, LearnerView } from "@/modules/learning/contract";
import { maxAttemptsPerStep } from "@/modules/learning/rules";
import { readLearnerView } from "@/modules/learning/service";

import { CodeBlock } from "../../code-block";
import { citationStateLabels } from "../../messages";

import { answerStepAction, startRouteAction } from "./actions";
import { StepHelp } from "./step-help";

type LearnPageProps = {
  params: Promise<{ spaceId: string; routeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Each state has a word and an icon, never only a color. */
const stateInfo: Record<
  LearnerStep["state"],
  { label: string; icon: IconName | null; tone: string }
> = {
  acertado: { label: "Acertado", icon: "check", tone: "success" },
  resuelto_sin_acertar: {
    label: "Resuelto sin acertar",
    icon: "x",
    tone: "warning",
  },
  actual: { label: "Paso actual", icon: null, tone: "brand" },
  bloqueado: { label: "Bloqueado", icon: "lock", tone: "neutral" },
};

const errorMessages: Record<string, string> = {
  invalid:
    "Elige una opción o escribe una respuesta (hasta 200 caracteres) antes de comprobarla.",
  not_current: "Responde los pasos en orden: primero el paso actual.",
  already_resolved: "Ese paso ya está resuelto.",
  not_started: "Primero empieza la ruta.",
};

const letter = (index: number) => String.fromCharCode(65 + index);

function Citations({ spaceId, step }: { spaceId: string; step: LearnerStep }) {
  if (step.citations.length === 0) return null;
  return (
    <details className="citations">
      <summary>
        <Icon name="sources" size={16} />
        Fuentes de esta lección ({step.citations.length})
        {step.citations.some((citation) => citation.state !== "vigente") ? (
          <span className="badge warning">Revisar</span>
        ) : null}
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
            <span className="muted">{citation.location}</span>
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

function StepIndex({
  view,
  focusId,
  path,
}: {
  view: LearnerView;
  focusId: string | null;
  path: string;
}) {
  return (
    <ol className="learn-steps">
      {view.steps.map((step) => {
        const info = stateInfo[step.state];
        const content = (
          <>
            <span className={`learn-step-marker ${step.state}`}>
              {info.icon ? <Icon name={info.icon} size={14} /> : step.position}
            </span>
            <span className="learn-step-text">
              <span className="learn-step-title">{step.title}</span>
              <span className="learn-step-state">{info.label}</span>
            </span>
          </>
        );
        return (
          <li key={step.id}>
            {step.state === "bloqueado" ? (
              <span className="learn-step is-locked">{content}</span>
            ) : (
              <Link
                aria-current={step.id === focusId ? "step" : undefined}
                className="learn-step"
                href={`${path}?paso=${step.id}`}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ResultPanel({
  step,
  last,
  next,
  path,
}: {
  step: LearnerStep;
  last: string;
  next: LearnerStep | null;
  path: string;
}) {
  const fillIn = step.activityType === "completar";
  const correct = step.state === "acertado";
  return (
    <section
      aria-label="Resultado del paso"
      className={`feedback ${correct ? "is-correct" : "is-incorrect"}`}
    >
      <p className="feedback-title">
        <Icon name={correct ? "check" : "alert"} size={20} />
        {last === "correcta"
          ? "Respuesta correcta."
          : last === "incorrecta"
            ? "Respuesta incorrecta. Se agotaron los intentos."
            : correct
              ? "Acertaste este paso."
              : "Resolviste este paso sin acertar."}
      </p>
      {fillIn && step.acceptedAnswers ? (
        <>
          <p>
            Solución: <code>{step.acceptedAnswers[0]}</code>
          </p>
          {step.acceptedAnswers.length > 1 ? (
            <p className="muted">
              También se aceptaba:{" "}
              {step.acceptedAnswers.slice(1).map((answer, index) => (
                <span key={index}>
                  {index > 0 ? " · " : ""}
                  <code>{answer}</code>
                </span>
              ))}
            </p>
          ) : null}
        </>
      ) : step.correctOption !== null && step.options ? (
        <p>
          Respuesta correcta: {letter(step.correctOption)}.{" "}
          {step.options[step.correctOption]}
        </p>
      ) : null}
      {step.explanation ? <p className="muted">{step.explanation}</p> : null}
      <p className="muted">
        Tus respuestas:{" "}
        {fillIn
          ? step.writtenAnswers.map((answer, index) => (
              <span key={index}>
                {index > 0 ? " · " : ""}
                <code>{answer}</code>
              </span>
            ))
          : step.selectedOptions
              .map(
                (option) =>
                  `${letter(option)}. ${step.options?.[option] ?? ""}`,
              )
              .join(" · ")}
      </p>
      <div className="actions compact">
        {next ? (
          <Link className="button" href={`${path}?paso=${next.id}`}>
            Siguiente paso
            <Icon name="arrowRight" size={18} />
          </Link>
        ) : (
          <Link className="button" href={path}>
            Ver el resumen de la ruta
            <Icon name="arrowRight" size={18} />
          </Link>
        )}
      </div>
    </section>
  );
}

function Activity({
  step,
  spaceId,
  routeId,
  last,
}: {
  step: LearnerStep;
  spaceId: string;
  routeId: string;
  last: string;
}) {
  const left = step.attemptsLeft;
  return (
    <form action={answerStepAction} className="activity">
      <input name="spaceId" type="hidden" value={spaceId} />
      <input name="routeId" type="hidden" value={routeId} />
      <input name="stepId" type="hidden" value={step.id} />
      <input name="submissionId" type="hidden" value={randomUUID()} />
      {last === "incorrecta" ? (
        <p className="feedback is-incorrect" role="status">
          <Icon name="alert" size={18} />
          <span>
            Respuesta incorrecta.{" "}
            {left === 1 ? "Te queda 1 intento." : `Te quedan ${left} intentos.`}{" "}
            Repasa la lección o pide ayuda; pedir ayuda no consume intentos de
            respuesta.
          </span>
        </p>
      ) : null}
      <div className="activity-header">
        <p className="activity-question">{step.question}</p>
        <span className="attempts">
          <span aria-hidden="true" className="attempt-dots">
            {Array.from({ length: maxAttemptsPerStep }, (_, index) => (
              <span
                className={index < step.attemptsUsed ? "used" : undefined}
                key={index}
              />
            ))}
          </span>
          Intento {step.attemptsUsed + 1} de {maxAttemptsPerStep}
        </span>
      </div>
      {step.activityType === "completar" ? (
        <div className="field">
          <label htmlFor="answerText">Texto para el hueco</label>
          <input
            aria-describedby="answer-help"
            autoComplete="off"
            className="code-input"
            id="answerText"
            maxLength={200}
            name="answerText"
            required
            spellCheck={false}
          />
          <p className="field-help" id="answer-help">
            Escribe el fragmento exacto que va en el hueco resaltado. Cuentan
            mayúsculas, espacios internos y signos; solo se ignoran los espacios
            al inicio y al final. Una solución equivalente pero distinta no se
            acepta.
          </p>
        </div>
      ) : (
        <fieldset className="answer-options">
          <legend className="sr-only">Elige una respuesta</legend>
          {(step.options ?? []).map((option, index) => (
            <label className="answer-option" key={index}>
              <input
                name="selectedOption"
                required
                type="radio"
                value={index}
              />
              <span aria-hidden="true" className="option-letter">
                {letter(index)}
              </span>
              <span>
                <span className="sr-only">{letter(index)}. </span>
                {option}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <SubmitButton pendingLabel="Comprobando…">
        Comprobar respuesta
      </SubmitButton>
    </form>
  );
}

export default async function LearnPage({
  params,
  searchParams,
}: LearnPageProps) {
  const parsed = z
    .object({ spaceId: z.uuid(), routeId: z.uuid() })
    .safeParse(await params);
  if (!parsed.success) notFound();
  const { spaceId, routeId } = parsed.data;
  const path = `/spaces/${spaceId}/routes/${routeId}/learn`;

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) redirect(`/login?next=${encodeURIComponent(path)}`);

  const database = getApplicationDatabase();
  const view = await readLearnerView(
    {
      accessRepository: new PostgresAccessRepository(database),
      routeRepository: new PostgresRouteRepository(database, null),
      learningRepository: new PostgresLearningRepository(database),
    },
    { identityId: currentIdentity.id, spaceId, routeId },
  );
  if (!view) notFound();

  const query = await searchParams;
  const last = typeof query.ultimo === "string" ? query.ultimo : "";
  const requested = typeof query.paso === "string" ? query.paso : "";
  const error = typeof query.error === "string" ? query.error : "";
  const visible = view.steps.filter((step) => step.state !== "bloqueado");
  // The requested step if it can be seen; otherwise the current one. A
  // completed route without a request shows its summary.
  const focus =
    visible.find((step) => step.id === requested) ??
    view.steps.find((step) => step.state === "actual") ??
    null;
  const focusLast = focus && focus.id === requested ? last : "";
  const next = focus
    ? (view.steps.find(
        (step) => step.position > focus.position && step.state !== "bloqueado",
      ) ?? null)
    : null;
  const resolved = (step: LearnerStep) =>
    step.state === "acertado" || step.state === "resuelto_sin_acertar";

  return (
    <main className="learn-page">
      <div className="learn-header">
        <Link className="back-link" href={`/spaces/${spaceId}/routes`}>
          <Icon className="flip" name="chevronRight" size={16} />
          Rutas
        </Link>
        <h1>{view.title}</h1>
        <p className="route-objective">
          <strong>Objetivo:</strong> {view.objective}
        </p>
        {view.started ? (
          <div className="learn-progress">
            <span aria-hidden="true" className="segments">
              {view.steps.map((step) => (
                <span className={step.state} key={step.id} />
              ))}
            </span>
            <p className="meta" data-testid="learning-summary">
              {view.completed ? "Ruta completada" : "En progreso"} · pasos
              resueltos {view.resolvedSteps} de {view.totalSteps} · acertados{" "}
              {view.correctSteps} de {view.totalSteps}
            </p>
          </div>
        ) : null}
      </div>

      {view.needsReview ? (
        <p className="callout" role="status">
          <Icon name="alert" size={18} />
          Alguna fuente citada cambió o se eliminó después de publicar esta
          ruta. Puedes continuar; las citas afectadas están señaladas.
        </p>
      ) : null}
      {error && errorMessages[error] ? (
        <p className="error" role="alert">
          <Icon name="alert" size={18} />
          {errorMessages[error]}
        </p>
      ) : null}

      {!view.started ? (
        <section aria-label="Antes de empezar" className="card learn-start">
          <h2>Antes de empezar</h2>
          <ul className="learn-rules">
            <li>
              <Icon name="route" size={18} />
              {view.totalSteps} pasos, cada uno con una lección breve y una
              actividad.
            </li>
            <li>
              <Icon name="check" size={18} />
              Hasta {maxAttemptsPerStep} intentos por pregunta. El siguiente
              paso se desbloquea al resolver el actual.
            </li>
            <li>
              <Icon name="help" size={18} />
              Puedes pedir ayuda al asistente en cualquier paso sin gastar
              intentos.
            </li>
          </ul>
          <ol className="learn-preview">
            {view.steps.map((step) => (
              <li key={step.id}>{step.title}</li>
            ))}
          </ol>
          <form action={startRouteAction} className="inline-form">
            <input name="spaceId" type="hidden" value={spaceId} />
            <input name="routeId" type="hidden" value={routeId} />
            <SubmitButton pendingLabel="Empezando…">
              Empezar ruta
              <Icon name="arrowRight" size={18} />
            </SubmitButton>
          </form>
        </section>
      ) : (
        <div className="learn-layout">
          <nav aria-label="Pasos de la ruta" className="learn-nav">
            <details className="learn-nav-mobile">
              <summary>
                Pasos de la ruta · {view.resolvedSteps} de {view.totalSteps}{" "}
                resueltos
              </summary>
              <StepIndex focusId={focus?.id ?? null} path={path} view={view} />
            </details>
            <div className="learn-nav-desktop">
              <StepIndex focusId={focus?.id ?? null} path={path} view={view} />
            </div>
          </nav>

          <SwapTransition
            order={focus?.position ?? view.totalSteps + 1}
            swapKey={focus?.id ?? "ruta-completada"}
          >
            {focus ? (
              <article className="learn-step-view">
                <header>
                  <p className="eyebrow">
                    Paso {focus.position} de {view.totalSteps}
                  </p>
                  <h2>{focus.title}</h2>
                </header>
                <div className="lesson">
                  <p className="answer-text">{focus.lesson}</p>
                  <Citations spaceId={spaceId} step={focus} />
                </div>
                {focus.code ? <CodeBlock code={focus.code} /> : null}
                <SwapTransition
                  swapKey={resolved(focus) ? "resultado" : "actividad"}
                >
                  {resolved(focus) ? (
                    <div className="learn-result">
                      <p className="activity-question">{focus.question}</p>
                      <ResultPanel
                        last={focusLast}
                        next={next}
                        path={path}
                        step={focus}
                      />
                    </div>
                  ) : (
                    <Activity
                      last={focusLast}
                      routeId={routeId}
                      spaceId={spaceId}
                      step={focus}
                    />
                  )}
                </SwapTransition>
                <StepHelp
                  position={focus.position}
                  resolved={resolved(focus)}
                  routeId={routeId}
                  stepId={focus.id}
                  title={focus.title}
                />
              </article>
            ) : (
              <section
                aria-label="Ruta completada"
                className="card learn-complete"
              >
                <span className="learn-complete-icon">
                  <Icon name="check" size={28} />
                </span>
                <h2>Ruta completada</h2>
                <p>
                  Resolviste los {view.totalSteps} pasos y acertaste{" "}
                  {view.correctSteps}.
                </p>
                <p className="muted">
                  Completar la ruta no implica dominio del contenido. Puedes
                  repasar cualquier paso o consultar al asistente cuando lo
                  necesites.
                </p>
                <div className="actions">
                  <Link
                    className="button"
                    href={`${path}?paso=${view.steps[0]?.id ?? ""}`}
                  >
                    Repasar los pasos
                  </Link>
                  <Link
                    className="button secondary"
                    href={`/spaces/${spaceId}/assistant`}
                  >
                    <Icon name="assistant" size={18} />
                    Consultar al asistente
                  </Link>
                </div>
              </section>
            )}
          </SwapTransition>
        </div>
      )}
    </main>
  );
}
