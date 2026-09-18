"use server";

import { redirect } from "next/navigation";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import {
  emailSchema,
  loginSchema,
  passwordUpdateSchema,
  safeInternalPath,
} from "@/modules/identity/input";

export async function loginAction(formData: FormData) {
  const input = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const next = safeInternalPath(formData.get("next"));

  if (!input.success) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const identity = await createSupabaseIdentityGateway();
  const result = await identity.signIn(input.data.email, input.data.password);

  if (!result.ok) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export async function logoutAction() {
  const identity = await createSupabaseIdentityGateway();
  await identity.signOut();
  redirect("/login?notice=signed-out");
}

export async function requestPasswordRecoveryAction(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));

  if (email.success) {
    const identity = await createSupabaseIdentityGateway();
    await identity.requestPasswordRecovery(email.data);
  }

  redirect("/recover?notice=requested");
}

export async function updatePasswordAction(formData: FormData) {
  const input = passwordUpdateSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!input.success) {
    redirect("/auth/update-password?error=invalid-password");
  }

  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();
  if (!currentIdentity) {
    redirect("/login?error=invalid-link");
  }

  const result = await identity.updatePassword(input.data.password);
  if (!result.ok) {
    redirect("/auth/update-password?error=update-failed");
  }

  await identity.signOut();
  redirect("/login?notice=password-updated");
}
