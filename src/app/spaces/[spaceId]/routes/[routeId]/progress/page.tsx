import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresLearningRepository } from "@/adapters/postgres/learning-repository";
import { PostgresRouteRepository } from "@/adapters/postgres/route-repository";
import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import type { TeamMemberProgress } from "@/modules/learning/contract";
import { readTeamProgress } from "@/modules/learning/service";

type ProgressPageProps = {
  params: Promise<{ spaceId: string; routeId: string }>;
};

const stateLabels: Record<TeamMemberProgress["state"], string> = {
  no_empezada: "No empezada",
  en_progreso: "En progreso",
  completada: "Completada",
};

const formatDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("es", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(value)
    : "—";

export default async function TeamProgressPage({ params }: ProgressPageProps) {
  const parsed = z
    .object({ spaceId: z.uuid(), routeId: z.uuid() })
    .safeParse(await params);
  if (!parsed.success) notFound();
  const { spaceId, routeId } = parsed.data;

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect(
      `/login?next=${encodeURIComponent(`/spaces/${spaceId}/routes/${routeId}/progress`)}`,
    );
  }

  const database = getApplicationDatabase();
  const progress = await readTeamProgress(
    {
      accessRepository: new PostgresAccessRepository(database),
      routeRepository: new PostgresRouteRepository(database, null),
      learningRepository: new PostgresLearningRepository(database),
    },
    { identityId: currentIdentity.id, spaceId, routeId },
  );
  if (!progress) notFound();

  return (
    <main className="wide">
      <p className="eyebrow">Progreso del equipo · solo responsables</p>
      <h1>{progress.title}</h1>
      <p className="notice" data-testid="team-summary">
        Miembros activos: {progress.activeMembers} · empezaron:{" "}
        {progress.started} · completaron: {progress.completed}
      </p>
      <p className="muted">
        Completar la ruta significa haber resuelto todos sus pasos y no implica
        dominio del contenido. “Acertados” son los pasos respondidos
        correctamente dentro de los 3 intentos. “No empezada” solo indica que no
        hay progreso registrado. Los resultados corresponden a la versión
        publicada actual; los miembros retirados no se muestran.
      </p>

      <table className="team-progress">
        <thead>
          <tr>
            <th scope="col">Miembro</th>
            <th scope="col">Estado</th>
            <th scope="col">Pasos resueltos</th>
            <th scope="col">Pasos acertados</th>
            <th scope="col">Inicio</th>
            <th scope="col">Finalización</th>
          </tr>
        </thead>
        <tbody>
          {progress.members.map((member) => (
            <tr key={member.profileId}>
              <th scope="row">
                {member.email ?? "Identidad sin correo"}
                {member.role === "responsable" ? " (responsable)" : ""}
              </th>
              <td>{stateLabels[member.state]}</td>
              <td>
                {member.resolvedSteps} de {progress.totalSteps}
              </td>
              <td>
                {member.correctSteps} de {progress.totalSteps}
              </td>
              <td>{formatDate(member.startedAt)}</td>
              <td>{formatDate(member.completedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
