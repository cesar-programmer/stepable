import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { PostgresSourceRepository } from "@/adapters/postgres/source-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { Icon } from "@/app/components/icons";
import { spaceIdSchema } from "@/modules/access/input";
import { routeLimits } from "@/modules/routes/contract";
import { listSpaceRoutes } from "@/modules/routes/service";
import { listSpaceSources } from "@/modules/sources/service";

import { CreateRouteForm } from "./create-route-form";

export default async function NewRoutePage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const parsed = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsed.success) notFound();
  const spaceId = parsed.data;
  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${spaceId}/routes/new`)}`,
    );
  }
  const database = getApplicationDatabase();
  const accessRepository = new PostgresAccessRepository(database);
  const sourceRepository = new PostgresSourceRepository(database, null);
  const ids = { identityId: identity.id, spaceId };
  const [listing, sources] = await Promise.all([
    listSpaceRoutes(
      {
        accessRepository,
        routeRepository: new PostgresRouteRepository(database, null),
      },
      ids,
    ),
    listSpaceSources({ accessRepository, sourceRepository }, ids),
  ]);
  // Only responsibles create routes; the action authorizes again.
  if (!listing?.canManage || !sources) notFound();
  const withCode = new Set(
    await sourceRepository.listSourceIdsWithCodeBlocks(spaceId),
  );

  return (
    <main className="wide-page">
      <div className="page-header">
        <div>
          <Link className="back-link" href={`/spaces/${spaceId}/routes`}>
            <Icon name="chevronRight" className="flip" size={16} />
            Rutas
          </Link>
          <h1>Crear ruta</h1>
          <p className="muted">
            Describe el objetivo, elige los documentos y cómo practicará el
            equipo. Revisarás el borrador antes de publicarlo.
          </p>
        </div>
      </div>
      <CreateRouteForm
        dailyGenerations={routeLimits.dailyGenerationAttempts}
        generationsLeftToday={listing.generationsLeftToday ?? 0}
        maxSources={routeLimits.maxSources}
        objectiveMax={routeLimits.objectiveMaxChars}
        objectiveMin={routeLimits.objectiveMinChars}
        sources={sources.sources
          .filter((source) => source.status === "lista")
          .map((source) => ({
            id: source.id,
            title: source.title,
            versionNumber: source.versionNumber,
            format: source.format,
            hasCodeBlock: withCode.has(source.id),
          }))}
        spaceId={spaceId}
      />
    </main>
  );
}
