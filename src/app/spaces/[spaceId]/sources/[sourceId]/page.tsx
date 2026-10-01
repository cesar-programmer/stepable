import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { sourceIdentifiersSchema } from "@/modules/sources/input";
import { readSourceContent } from "@/modules/sources/service";

import { sourceReadDependencies } from "../dependencies";
import { sourceErrorMessages, sourceStatusLabels } from "../messages";

type SourcePageProps = {
  params: Promise<{ spaceId: string; sourceId: string }>;
};

export default async function SourcePage({ params }: SourcePageProps) {
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
  const { source, sections } = content;

  return (
    <main className="wide">
      <p className="eyebrow">Fuente · versión {source.versionNumber}</p>
      <h1>{source.title}</h1>
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
