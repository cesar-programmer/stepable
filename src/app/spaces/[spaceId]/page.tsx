import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { spaceIdSchema } from "@/modules/access/input";

type SpacePageProps = {
  params: Promise<{ spaceId: string }>;
};

export default async function SpacePage({ params }: SpacePageProps) {
  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();

  if (!currentIdentity) {
    redirect("/login?next=/spaces");
  }

  const parsedSpaceId = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsedSpaceId.success) {
    notFound();
  }

  const repository = new PostgresAccessRepository(getApplicationDatabase());
  const space = await repository.findSpaceForIdentity(
    currentIdentity.id,
    parsedSpaceId.data,
  );

  if (!space) {
    notFound();
  }

  return (
    <main>
      <p className="eyebrow">Espacio autorizado</p>
      <h1>{space.name}</h1>
      <dl className="space-details">
        <div>
          <dt>Clave</dt>
          <dd>{space.slug}</dd>
        </div>
        <div>
          <dt>Tu rol</dt>
          <dd>{space.role}</dd>
        </div>
      </dl>
      <div className="actions">
        <Link className="button secondary" href="/spaces">
          Volver a tus espacios
        </Link>
      </div>
    </main>
  );
}
