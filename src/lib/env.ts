import { z } from "zod";

const localEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

export type LocalEnvironment = z.infer<typeof localEnvironmentSchema>;

export function parseLocalEnvironment(
  values: Record<string, string | undefined>,
): LocalEnvironment {
  return localEnvironmentSchema.parse(values);
}
