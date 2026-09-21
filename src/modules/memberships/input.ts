import { z } from "zod";

import { spaceRoles } from "../access/contract.ts";

export const memberRoleChangeInputSchema = z.object({
  spaceId: z.uuid(),
  targetProfileId: z.uuid(),
  role: z.enum(spaceRoles),
});

export const memberMutationInputSchema = z.object({
  spaceId: z.uuid(),
  targetProfileId: z.uuid(),
});

export const leaveSpaceInputSchema = z.object({
  spaceId: z.uuid(),
});
