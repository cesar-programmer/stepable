import { randomUUID } from "node:crypto";

import type { Sql } from "postgres";

export type SeedStep = {
  title: string;
  lesson: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

/** Inserts an already published route citing one source version. Test-only. */
export async function seedPublishedRoute(
  client: Sql,
  input: {
    spaceId: string;
    creatorId: string;
    title: string;
    source: { sourceId: string; versionId: string; title: string };
    steps: SeedStep[];
  },
): Promise<{ routeId: string; stepIds: string[] }> {
  const routeId = randomUUID();
  await client`
    insert into public.routes
      (id, space_id, objective, title, status, generation_status,
       generation_token, created_by, published_by, published_at)
    values (${routeId}, ${input.spaceId}, ${`Objetivo de ${input.title}`},
      ${input.title}, 'publicada', 'lista', ${randomUUID()}, ${input.creatorId},
      ${input.creatorId}, now())
  `;
  const stepIds: string[] = [];
  for (const [index, step] of input.steps.entries()) {
    const [inserted] = await client<{ id: string }[]>`
      insert into public.route_steps
        (route_id, position, title, lesson, question, options, correct_option,
         explanation)
      values (${routeId}, ${index + 1}, ${step.title}, ${step.lesson},
        ${step.question}, ${step.options}, ${step.correct}, ${step.explanation})
      returning id
    `;
    await client`
      insert into public.route_citations
        (step_id, ref, space_id, source_id, version_id, version_number,
         source_title, location)
      values (${inserted.id}, 1, ${input.spaceId}, ${input.source.sourceId},
        ${input.source.versionId}, 1, ${input.source.title}, 'Página 1')
    `;
    stepIds.push(inserted.id);
  }
  return { routeId, stepIds };
}
