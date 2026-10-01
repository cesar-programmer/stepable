import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresLearningRepository } from "@/adapters/postgres/learning-repository";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import type { LearnerStep } from "@/modules/learning/contract";
import { maxAttemptsPerStep } from "@/modules/learning/rules";
import { readLearnerView } from "@/modules/learning/service";

import { citationStateLabels } from "../../messages";

import { answerStepAction, startRouteAction } from "./actions";

type LearnPageProps = {
  params: Promise<{ spaceId: string; routeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const stateLabels: Record<LearnerStep["state"], string> = {
  acertado: "Acertado",
  resuelto_sin_acertar: "Resuelto sin acertar",
  actual: "En curso",
  bloqueado: "Bloqueado",
};

const errorMessages: Record<string, string> = {
  invalid: "Elige una de las opciones antes de responder.",
  not_current: "Responde los pasos en orden.",
  already_resolved: "Ese paso ya está resuelto.",
  not_started: "Primero empieza la ruta.",
};

const letter = (index: number) => String.fromCharCode(65 + index);

function StepCitations({
  spaceId,
  step,
}: {
  spaceId: string;
  step: LearnerStep;
}) {
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
          · {citation.location}
          {citation.state !== "vigente" ? (
            <span className="status fallida">
              {citationStateLabels[citation.state]}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
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
  const lastStep = typeof query.paso === "string" ? query.paso : "";
  const error = typeof query.error === "string" ? query.error : "";
  const hidden = (
    <>
      <input name="spaceId" type="hidden" value={spaceId} />
      <input name="routeId" type="hidden" value={routeId} />
    </>
  );

  return (
    <main className="wide">
      <p className="eyebrow">Recorrido de la ruta</p>
      <h1>{view.title}</h1>
      <p>
        <strong>Objetivo:</strong> {view.objective}
      </p>
      {view.needsReview ? (
        <p className="error" role="alert">
          Aviso: alguna fuente citada cambió o se eliminó después de publicar
          esta ruta. Puedes continuar; las citas afectadas están señaladas.
        </p>
      ) : null}
      {error && errorMessages[error] ? (
        <p className="error" role="alert">
          {errorMessages[error]}
        </p>
      ) : null}

      {!view.started ? (
        <form action={startRouteAction}>
          {hidden}
          <p>
            {view.totalSteps} pasos. Cada pregunta admite hasta{" "}
            {maxAttemptsPerStep} intentos; el siguiente paso se desbloquea al
            resolver el actual.
          </p>
          <button type="submit">Empezar ruta</button>
        </form>
      ) : (
        <p className="notice" data-testid="learning-summary">
          {view.completed ? "Ruta completada" : "En progreso"} · pasos resueltos{" "}
          {view.resolvedSteps} de {view.totalSteps} · acertados{" "}
          {view.correctSteps} de {view.totalSteps}
          {view.completed
            ? ". Completar la ruta no implica dominio del contenido."
            : ""}
        </p>
      )}

      {view.started ? (
        <ol className="route-steps">
          {view.steps.map((step) => (
            <li key={step.id}>
              <h2>
                {step.position}. {step.title}{" "}
                <span
                  className={`status ${step.state === "acertado" ? "lista" : step.state === "actual" ? "procesando" : step.state === "resuelto_sin_acertar" ? "fallida" : ""}`}
                >
                  {stateLabels[step.state]}
                </span>
              </h2>
              {step.lesson ? (
                <>
                  <p className="answer-text">{step.lesson}</p>
                  <StepCitations spaceId={spaceId} step={step} />
                  <p>
                    <strong>Pregunta:</strong> {step.question}
                  </p>
                </>
              ) : null}

              {lastStep === step.id && last ? (
                <p
                  className={last === "correcta" ? "notice" : "error"}
                  role="status"
                >
                  {last === "correcta"
                    ? "Respuesta correcta."
                    : step.state === "actual"
                      ? `Respuesta incorrecta. ${step.attemptsLeft === 1 ? "Te queda 1 intento." : `Te quedan ${step.attemptsLeft} intentos.`}`
                      : "Respuesta incorrecta. Se agotaron los intentos."}
                </p>
              ) : null}

              {step.state === "actual" && step.options ? (
                <form action={answerStepAction}>
                  {hidden}
                  <input name="stepId" type="hidden" value={step.id} />
                  <input
                    name="submissionId"
                    type="hidden"
                    value={randomUUID()}
                  />
                  <fieldset>
                    <legend>
                      Intento {step.attemptsUsed + 1} de {maxAttemptsPerStep}
                    </legend>
                    {step.options.map((option, index) => (
                      <label className="checkbox" key={index}>
                        <input
                          name="selectedOption"
                          required
                          type="radio"
                          value={index}
                        />
                        {letter(index)}. {option}
                      </label>
                    ))}
                  </fieldset>
                  <button type="submit">Responder paso {step.position}</button>
                </form>
              ) : null}

              {step.correctOption !== null && step.options ? (
                <div className="assistant-answer">
                  <p>
                    Respuesta correcta: {letter(step.correctOption)}.{" "}
                    {step.options[step.correctOption]}
                  </p>
                  <p className="muted">{step.explanation}</p>
                  <p className="muted">
                    Tus respuestas:{" "}
                    {step.selectedOptions.map(letter).join(", ")}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="actions">
        <Link
          className="button secondary"
          href={`/spaces/${spaceId}/routes/${routeId}`}
        >
          Volver a la ruta
        </Link>
      </div>
    </main>
  );
}
