import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { AutoRefresh } from "@/app/components/auto-refresh";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { maxManualRetries } from "@/modules/sources/contract";
import { sourceIdentifiersSchema } from "@/modules/sources/input";
import { readSourceContent } from "@/modules/sources/service";

import { sourceReadDependencies } from "../dependencies";
import {
  sourceErrorMessages,
  sourceFormatLabels,
  sourceNoticeMessages,
  sourceStatusLabels,
} from "../messages";

import { deleteSourceAction, retrySourceAction } from "./actions";

type SourcePageProps = {
  params: Promise<{ spaceId: string; sourceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const inProgress = (status: string) =>
  status === "en_cola" || status === "procesando";

export default async function SourcePage({
  params,
  searchParams,
}: SourcePageProps) {
  const parsed = sourceIdentifiersSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { spaceId, sourceId } = parsed.data;

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${spaceId}/sources/${sourceId}`)}`,
    );
  }

  const content = await readSourceContent(sourceReadDependencies(), {
    identityId: currentIdentity.id,
    spaceId,
    sourceId,
  });
  if (!content) notFound();
  const { canManage, source, sections } = content;

  const parameters = await searchParams;
  const notice = typeof parameters.notice === "string" ? parameters.notice : "";
  const error = typeof parameters.error === "string" ? parameters.error : "";

  // The version a manager can act on: a pending candidate, or the displayed
  // version when there is no current one yet.
  const actionable = source.pending ?? {
    versionNumber: source.versionNumber,
    format: source.format,
    status: source.status,
    errorCode: source.errorCode,
    manualRetries: source.manualRetries,
  };
  const busy = inProgress(actionable.status);
  const retriesLeft = maxManualRetries - actionable.manualRetries;

  return (
    <main className="wide">
      <AutoRefresh active={canManage && busy} />
      <p className="eyebrow">Fuente · versión {source.versionNumber}</p>
      <h1>{source.title}</h1>
      {notice && sourceNoticeMessages[notice] ? (
        <p className="notice">{sourceNoticeMessages[notice]}</p>
      ) : null}
      {error && sourceErrorMessages[error] ? (
        <p className="error" role="alert">
          {sourceErrorMessages[error]}
        </p>
      ) : null}
      <p>
        Estado: <strong>{sourceStatusLabels[source.status]}</strong>
        {source.status === "lista"
          ? source.format === "pdf"
            ? ` · ${source.pageCount} páginas, ${sections.length} con texto`
            : ` · ${sections.length} secciones`
          : ""}
      </p>
      {source.status === "fallida" && source.errorCode ? (
        <p className="error" role="alert">
          {sourceErrorMessages[source.errorCode] ??
            "No fue posible procesar la fuente."}
        </p>
      ) : null}

      {canManage ? (
        <section className="source-management">
          {source.pending ? (
            <p>
              Reemplazo · versión {source.pending.versionNumber} (
              {sourceFormatLabels[source.pending.format]}):{" "}
              <span className={`status ${source.pending.status}`}>
                {sourceStatusLabels[source.pending.status]}
              </span>{" "}
              {source.pending.status === "fallida" && source.pending.errorCode
                ? (sourceErrorMessages[source.pending.errorCode] ??
                  "No fue posible procesar la versión.")
                : null}
              {source.pending.status === "fallida"
                ? " La versión vigente sigue disponible."
                : null}
            </p>
          ) : null}

          {actionable.status === "fallida" ? (
            retriesLeft > 0 ? (
              <form action={retrySourceAction} className="inline-form">
                <input name="spaceId" type="hidden" value={spaceId} />
                <input name="sourceId" type="hidden" value={sourceId} />
                <button type="submit">
                  Reintentar procesamiento (quedan {retriesLeft})
                </button>
              </form>
            ) : (
              <p className="muted">
                Sin reintentos manuales disponibles. Carga un archivo corregido.
              </p>
            )
          ) : null}

          {busy ? (
            <p className="muted">
              Hay una versión en procesamiento; el reemplazo se habilitará al
              terminar.
            </p>
          ) : (
            <form
              action={`/spaces/${spaceId}/sources/${sourceId}/replace`}
              encType="multipart/form-data"
              method="post"
            >
              <label>
                Reemplazar con otro archivo (Markdown hasta 1 MiB o PDF con
                texto hasta 8 MiB)
                <input
                  accept=".md,.markdown,.pdf,text/markdown,application/pdf"
                  name="file"
                  required
                  type="file"
                />
              </label>
              <button type="submit">Reemplazar archivo</button>
            </form>
          )}

          <form action={deleteSourceAction} className="danger-zone">
            <input name="spaceId" type="hidden" value={spaceId} />
            <input name="sourceId" type="hidden" value={sourceId} />
            <label className="checkbox">
              <input
                name="confirmacion"
                required
                type="checkbox"
                value="eliminar"
              />
              Entiendo que se eliminarán la fuente, todas sus versiones y sus
              archivos, sin papelera ni recuperación.
            </label>
            <ConfirmSubmitButton
              className="danger"
              message="¿Eliminar definitivamente esta fuente con todas sus versiones y archivos? No hay papelera."
            >
              Eliminar fuente
            </ConfirmSubmitButton>
          </form>
        </section>
      ) : null}

      <ol className="section-list">
        {sections.map((section) => (
          <li key={section.ordinal}>
            <p className="muted">
              {section.pageNumber !== null
                ? `Página ${section.pageNumber}`
                : `${
                    section.headingPath.length > 0
                      ? section.headingPath.join(" › ")
                      : "Inicio del documento"
                  } · líneas ${section.startLine}–${section.endLine}`}
            </p>
            <pre>{section.content}</pre>
          </li>
        ))}
      </ol>

      <div className="actions">
        <Link className="button secondary" href={`/spaces/${spaceId}/sources`}>
          Volver a fuentes
        </Link>
      </div>
    </main>
  );
}
