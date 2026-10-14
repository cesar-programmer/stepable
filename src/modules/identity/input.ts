import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const passwordUpdateSchema = z
  .object({
    password: z.string().min(8),
    confirmation: z.string(),
  })
  .refine(({ password, confirmation }) => password === confirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmation"],
  });

export function safeInternalPath(value: FormDataEntryValue | null): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    // After signing in, people land on their spaces.
    return "/spaces";
  }

  return value;
}
