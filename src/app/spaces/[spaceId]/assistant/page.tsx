import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { configuredModels } from "@/adapters/ai/models";
import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { authorizeSpaceAction } from "@/modules/access/authorization";
import { spaceIdSchema } from "@/modules/access/input";

import { AssistantForm } from "./assistant-form";

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
  const space = await authorizeSpaceAction(
    new PostgresAccessRepository(getApplicationDatabase()),
    currentIdentity.id,
    spaceId,
    "consultar_fuentes",
  );
  if (!space) notFound();

  const models = configuredModels(process.env);

  return (
    <main className="wide">
      <p className="eyebrow">{space.name}</p>
      <h1>Asistente</h1>
      <p>
        Responde con citas a las fuentes vigentes de este espacio. Si no hay
        evidencia suficiente, lo indica. No se guarda historial.
      </p>
      <p className="muted" data-testid="assistant-mode">
        Conversación: {models.chatMode} · Embeddings: {models.embeddingsMode}
        {models.chatMode === "simulado"
          ? " (solo pruebas técnicas; no valida el asistente real)"
          : ""}
      </p>
      {models.configurationError ? (
        <p className="error" role="alert">
          Configuración de IA incompleta: {models.configurationError}
        </p>
      ) : null}
      <AssistantForm spaceId={spaceId} />
      <div className="actions">
        <Link className="button secondary" href={`/spaces/${spaceId}`}>
          Volver al espacio
        </Link>
      </div>
    </main>
  );
}
