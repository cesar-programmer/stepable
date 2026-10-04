import { z } from "zod";

import { assistantLimits } from "./contract.ts";

export type ParsedAnswer =
  | {
      kind: "answered";
      answer: string;
      refs: number[];
      /** The answer cites `localEvidence.marker`; never set otherwise. */
      citesLocal: boolean;
    }
  | { kind: "insufficient" }
  | { kind: "unverifiable" };

const modelAnswerSchema = z.object({
  estado: z.enum(["respondida", "insuficiente"]),
  respuesta: z.string().max(assistantLimits.answerMaxChars).default(""),
  citas: z.array(z.number().int()).max(50).default([]),
});

function referencedNumbers(answer: string): number[] {
  const refs: number[] = [];
  for (const match of answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const value of match[1].split(",")) refs.push(Number(value.trim()));
  }
  return refs;
}

/**
 * Accepts an answer only when every citation, in the text or in the list,
 * points to a fragment that was actually sent. An answer without citations,
 * or with any invented one, is unverifiable and is not shown. A caller may
 * accept one extra, non-numeric marker for evidence it shows itself (the
 * step's own code); fragment citations are still checked the same way.
 */
export function parseModelAnswer(
  text: string,
  availableRefs: number[],
  localEvidence?: { marker: string },
): ParsedAnswer {
  const json = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: z.infer<typeof modelAnswerSchema>;
  try {
    parsed = modelAnswerSchema.parse(JSON.parse(json));
  } catch {
    return { kind: "unverifiable" };
  }
  if (parsed.estado === "insuficiente") return { kind: "insufficient" };

  const answer = parsed.respuesta.trim();
  const refs = [...new Set([...referencedNumbers(answer), ...parsed.citas])];
  const available = new Set(availableRefs);
  const citesLocal = localEvidence
    ? answer.toLowerCase().includes(localEvidence.marker.toLowerCase())
    : false;
  if (
    answer.length === 0 ||
    (refs.length === 0 && !citesLocal) ||
    refs.some((ref) => !available.has(ref))
  ) {
    return { kind: "unverifiable" };
  }
  return {
    kind: "answered",
    answer,
    refs: refs.sort((a, b) => a - b),
    citesLocal,
  };
}
