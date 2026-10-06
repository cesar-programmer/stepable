import { authorizeSpaceAction } from "../access/authorization.ts";
import type { AccessRepository } from "../access/contract.ts";

import type { UsageLimits, UsageRepository, UsageSummary } from "./contract.ts";

/**
 * The space's own estimated consumption today, for its active
 * responsibles. Other spaces' figures are never exposed: of the global
 * budget, only whether it is exhausted.
 */
export async function readUsageSummary(
  dependencies: {
    accessRepository: AccessRepository;
    usageRepository: UsageRepository;
  },
  input: {
    identityId: string;
    spaceId: string;
    namespace: string;
    limits: UsageLimits;
  },
): Promise<UsageSummary | null> {
  if (
    !(await authorizeSpaceAction(
      dependencies.accessRepository,
      input.identityId,
      input.spaceId,
      "consultar_consumo_ia",
    ))
  ) {
    return null;
  }
  return dependencies.usageRepository.summary({
    namespace: input.namespace,
    spaceId: input.spaceId,
    limits: input.limits,
  });
}
