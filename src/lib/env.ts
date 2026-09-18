import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const localEnvironmentSchema = publicEnvironmentSchema.extend({
  DATABASE_URL: z.string().min(1),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type LocalEnvironment = z.infer<typeof localEnvironmentSchema>;

export function parsePublicEnvironment(
  values: Record<string, string | undefined>,
): PublicEnvironment {
  return publicEnvironmentSchema.parse(values);
}

export function parseLocalEnvironment(
  values: Record<string, string | undefined>,
): LocalEnvironment {
  return localEnvironmentSchema.parse(values);
}

export function getPublicEnvironment(): PublicEnvironment {
  return parsePublicEnvironment(process.env);
}

export function getLocalEnvironment(): LocalEnvironment {
  return parseLocalEnvironment(process.env);
}
