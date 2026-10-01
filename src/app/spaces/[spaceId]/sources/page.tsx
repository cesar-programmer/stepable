import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { AutoRefresh } from "@/app/components/auto-refresh";
import { spaceIdSchema } from "@/modules/access/input";
import { listSpaceSources } from "@/modules/sources/service";

import { sourceReadDependencies } from "./dependencies";
import {
  sourceErrorMessages,
  sourceFormatLabels,
  sourceNoticeMessages,
  sourceStatusLabels,
} from "./messages";

type SourcesPageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourcesPage({
  params,
  searchParams,
}: SourcesPageProps) {
  const parsedSpaceId = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsedSpaceId.success) notFound();
  const spaceId = parsedSpaceId.data;

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect(`/login?next=${encodeURIComponent(`/spaces/${spaceId}/sources`)}`);
  }

  const listing = await listSpaceSources(sourceReadDependencies(), {
    identityId: currentIdentity.id,
    spaceId,
  });
  if (!listing) notFound();

  const parameters = await searchParams;
  const notice = typeof parameters.notice === "string" ? parameters.notice : "";
  const error = typeof parameters.error === "string" ? parameters.error : "";
  const isBusy = (status: string) =>
    status === "en_cola" || status === "procesando";
  const inProgress = listing.sources.some(
    (source) =>
      isBusy(source.status) ||
      (source.pending !== null && isBusy(source.pending.status)),
  );

  return (
    <main className="wide">
      <AutoRefresh active={inProgress} />
      <p className="eyebrow">Fuentes del espacio</p>
      <h1>Fuentes</h1>
      {notice && sourceNoticeMessages[notice] ? (
        <p className="notice">{sourceNoticeMessages[notice]}</p>
      ) : null}
      {error && sourceErrorMessages[error] ? (
        <p className="error" role="alert">
          {sourceErrorMessages[error]}
        </p>
      ) : null}

      {listing.canManage ? (
        <form
          action={`/spaces/${spaceId}/sources/upload`}
          encType="multipart/form-data"
          method="post"
        >
          <label>
            Archivo Markdown (hasta 1 MiB) o PDF con texto (hasta 8 MiB y 200
            páginas)
            <input
              accept=".md,.markdown,.pdf,text/markdown,application/pdf"
              name="file"
              required
              type="file"
            />
          </label>
          <label>
            Título (opcional)
            <input maxLength={120} name="title" type="text" />
          </label>
          <button type="submit">Cargar fuente</button>
        </form>
      ) : (
        <p className="muted">
          Solo se muestran las fuentes listas para consultar.
        </p>
      )}

      {listing.sources.length === 0 ? (
        <p className="empty-state">Todavía no hay fuentes.</p>
      ) : (
        <ul className="source-list">
          {listing.sources.map((source) => (
            <li key={source.id}>
              <div>
                {source.status === "lista" || listing.canManage ? (
                  <Link href={`/spaces/${spaceId}/sources/${source.id}`}>
                    {source.title}
                  </Link>
                ) : (
                  <strong>{source.title}</strong>
                )}
                <span className="muted">
                  {sourceFormatLabels[source.format]} · versión{" "}
                  {source.versionNumber}
                  {source.pageCount !== null
                    ? ` · ${source.pageCount} páginas`
                    : ""}
                  {source.sectionCount !== null
                    ? ` · ${source.sectionCount} ${source.format === "pdf" ? "con texto" : "secciones"}`
                    : ""}
                </span>
              </div>
              <div>
                <span className={`status ${source.status}`}>
                  {sourceStatusLabels[source.status]}
                </span>
                {source.status === "fallida" && source.errorCode ? (
                  <span className="error-detail">
                    {sourceErrorMessages[source.errorCode] ??
                      "No fue posible procesar la fuente."}
                  </span>
                ) : null}
                {source.pending ? (
                  <span className="muted">
                    Reemplazo v{source.pending.versionNumber}:{" "}
                    {sourceStatusLabels[source.pending.status]}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <Link className="button secondary" href={`/spaces/${spaceId}`}>
          Volver al espacio
        </Link>
      </div>
    </main>
  );
}
