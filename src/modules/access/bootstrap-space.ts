import type { AccessRepository, BootstrapSpaceResult } from "./contract.ts";
import { bootstrapSpaceInputSchema } from "./input.ts";

export async function bootstrapSpace(
  repository: AccessRepository,
  rawInput: unknown,
): Promise<BootstrapSpaceResult> {
  return repository.bootstrapSpace(bootstrapSpaceInputSchema.parse(rawInput));
}
