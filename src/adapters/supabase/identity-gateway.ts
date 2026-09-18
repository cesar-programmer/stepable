import type {
  AuthenticatedIdentity,
  IdentityGateway,
  IdentityResult,
} from "@/modules/identity/contract";

import { createSupabaseServerClient } from "./server-client";

function failed(reason: "invalid" | "unavailable" = "invalid"): IdentityResult {
  return { ok: false, reason };
}

export async function createSupabaseIdentityGateway(): Promise<IdentityGateway> {
  const client = await createSupabaseServerClient();

  return {
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      return error ? failed() : { ok: true };
    },

    async signOut() {
      await client.auth.signOut();
    },

    async currentIdentity(): Promise<AuthenticatedIdentity | null> {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user?.email) {
        return null;
      }

      return { id: data.user.id, email: data.user.email };
    },

    async requestPasswordRecovery(email) {
      await client.auth.resetPasswordForEmail(email);
    },

    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      return error ? failed("unavailable") : { ok: true };
    },
  };
}
