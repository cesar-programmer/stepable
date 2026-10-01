import {
  assistantLimits,
  type FragmentCandidate,
  type RetrievedFragment,
} from "./contract.ts";

const reciprocalRankConstant = 60;

const keyOf = (candidate: FragmentCandidate) =>
  `${candidate.versionId}:${candidate.ordinal}`;

/**
 * Merges lexical and semantic candidate lists by reciprocal rank fusion. It
 * only combines positions; it does not re-score content with another model.
 */
export function mergeCandidates(
  lists: FragmentCandidate[][],
  limit: number = assistantLimits.fragments,
): FragmentCandidate[] {
  const scores = new Map<
    string,
    { candidate: FragmentCandidate; score: number }
  >();
  for (const list of lists) {
    list.forEach((candidate, index) => {
      const key = keyOf(candidate);
      const entry = scores.get(key) ?? { candidate, score: 0 };
      entry.score += 1 / (reciprocalRankConstant + index + 1);
      scores.set(key, entry);
    });
  }
  return [...scores.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/** Numbers fragments and bounds each fragment and the whole context. */
export function prepareFragments(
  candidates: FragmentCandidate[],
  limits: {
    fragmentMaxChars: number;
    contextMaxChars: number;
  } = assistantLimits,
): RetrievedFragment[] {
  const fragments: RetrievedFragment[] = [];
  let total = 0;
  for (const candidate of candidates) {
    const content =
      candidate.content.length > limits.fragmentMaxChars
        ? `${candidate.content.slice(0, limits.fragmentMaxChars)}…`
        : candidate.content;
    if (total + content.length > limits.contextMaxChars) break;
    total += content.length;
    fragments.push({ ...candidate, content, ref: fragments.length + 1 });
  }
  return fragments;
}

export function describeLocation(fragment: FragmentCandidate): string {
  if (fragment.pageNumber !== null) return `Página ${fragment.pageNumber}`;
  const heading =
    fragment.headingPath.length > 0
      ? fragment.headingPath.join(" › ")
      : "Inicio del documento";
  return `${heading} · líneas ${fragment.startLine}–${fragment.endLine}`;
}
