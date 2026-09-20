import { z } from "zod";

import { spaceRoles } from "../access/contract.ts";
import { emailSchema } from "../identity/input.ts";

export const invitationRoleSchema = z.enum(spaceRoles).default("integrante");

export const createInvitationInputSchema = z.object({
  spaceId: z.uuid(),
  email: emailSchema,
  role: invitationRoleSchema,
});

export const invitationMutationInputSchema = z.object({
  spaceId: z.uuid(),
  invitationId: z.uuid(),
});

export const invitationTokenSchema = z
  .string()
  .min(32)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);
