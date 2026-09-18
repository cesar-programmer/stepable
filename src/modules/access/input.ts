import { z } from "zod";

export const bootstrapSpaceInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
});

export const spaceIdSchema = z.uuid();
