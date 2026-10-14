import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { configuredModels } from "@/adapters/ai/models";
import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresSourceRepository } from "@/adapters/postgres/source-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { Icon } from "@/app/components/icons";
import { spaceIdSchema } from "@/modules/access/input";
import { assistantLimits } from "@/modules/knowledge/contract";
import { listSpaceSources } from "@/modules/sources/service";

import { ConsultForm } from "@/app/components/assistant/consult-form";

type AssistantPageProps = { params: Promise<{ spaceId: string }> };

export default async function AssistantPage({ params }: AssistantPageProps) {
  const parsedSpaceId = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsedSpaceId.success) notFound();
  const spaceId = parsedSpaceId.data;

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${spaceId}/assistant`)}`,
    );
  }
  const database = getApplicationDatabase();
  // Authorizes "consultar_fuentes" itself; null means no access.
  const listing = await listSpaceSources(
    {
      accessRepository: new PostgresAccessRepository(database),
      sourceRepository: new PostgresSourceRepository(database, null),
    },
    { identityId: currentIdentity.id, spaceId },
  );
  if (!listing) notFound();
  const readySources = listing.sources.filter(
    (source) => source.status === "lista",
  ).length;

  const models = configuredModels(process.env);

  return (
    <main className="assistant-page">
      <header className="assistant-header">
        <h1>Asistente</h1>
        <p className="lead">
          Responde con citas a partir de las fuentes vigentes del espacio. Cada
          pregunta se responde por separado: no recuerda las anteriores ni
          guarda historial.
        </p>
      </header>

      {models.configurationError ? (
        <p className="error" role="alert">
          Configuración de IA incompleta: {models.configurationError}
        </p>
      ) : null}

      {readySources === 0 ? (
        <section className="empty-state">
          <Icon name="sources" size={28} />
          <h2>Todavía no hay fuentes listas</h2>
          <p>
            El asistente solo responde con la documentación del espacio.{" "}
            {listing.canManage
              ? "Sube una fuente y espera a que termine de procesarse."
              : "Cuando un responsable suba una fuente, podrás preguntar aquí."}
          </p>
          {listing.canManage ? (
            <Link className="button" href={`/spaces/${spaceId}/sources`}>
              Ir a las fuentes
            </Link>
          ) : null}
        </section>
      ) : (
        <ConsultForm scope="espacio" variant="page" />
      )}

      <details className="tech-details">
        <summary>Detalles técnicos</summary>
        <p data-testid="assistant-mode">
          Conversación: {models.chatMode} · Embeddings: {models.embeddingsMode}
          {models.chatMode === "simulado"
            ? " (solo pruebas técnicas; no valida el asistente real)"
            : ""}
        </p>
        <p>
          Fuentes listas: {readySources}. Cada consulta recupera como máximo{" "}
          {assistantLimits.fragments} fragmentos. Con un modelo real, cuenta en
          los límites diarios de consumo de IA.
        </p>
      </details>
    </main>
  );
}
