import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type LocalAuthTestConfig = {
  apiUrl: string;
  databaseUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
  mailpitUrl: string;
};

export type LocalTestIdentity = {
  id: string;
  email: string;
  password: string;
  updatedPassword: string;
};

export function getLocalAuthTestConfig(): LocalAuthTestConfig {
  const config = {
    apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    databaseUrl: process.env.DATABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: process.env.STEPABLE_TEST_SUPABASE_SERVICE_ROLE_KEY,
    mailpitUrl: process.env.STEPABLE_TEST_MAILPIT_URL,
  };

  for (const [key, value] of Object.entries(config)) {
    if (!value) {
      throw new Error(`Falta la variable local de prueba ${key}.`);
    }
  }

  return config as LocalAuthTestConfig;
}

export function createAdminClient(config: LocalAuthTestConfig): SupabaseClient {
  return createClient(config.apiUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createPublicClient(
  config: LocalAuthTestConfig,
): SupabaseClient {
  return createClient(config.apiUrl, config.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createLocalTestIdentity(
  admin: SupabaseClient,
): Promise<LocalTestIdentity> {
  const suffix = randomUUID();
  const identity = {
    email: `e1-2-${suffix}@example.test`,
    password: `Initial-${randomUUID()}!`,
    updatedPassword: `Updated-${randomUUID()}!`,
  };
  const { data, error } = await admin.auth.admin.createUser({
    email: identity.email,
    password: identity.password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error("No fue posible crear la identidad efímera de prueba.");
  }

  return { id: data.user.id, ...identity };
}

export async function deleteLocalTestIdentity(
  admin: SupabaseClient,
  id: string,
) {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    throw new Error("No fue posible eliminar la identidad efímera de prueba.");
  }
}

type MailpitAddress = { Address?: string };
type MailpitSummary = { ID?: string; To?: MailpitAddress[] };

export async function waitForRecoveryLink(
  mailpitUrl: string,
  recipient: string,
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const listResponse = await fetch(`${mailpitUrl}/api/v1/messages`);
    if (listResponse.ok) {
      const payload = (await listResponse.json()) as {
        messages?: MailpitSummary[];
      };
      const message = payload.messages?.find((candidate) =>
        candidate.To?.some(
          (address) =>
            address.Address?.toLowerCase() === recipient.toLowerCase(),
        ),
      );

      if (message?.ID) {
        const messageResponse = await fetch(
          `${mailpitUrl}/api/v1/message/${message.ID}`,
        );
        if (messageResponse.ok) {
          const detail = (await messageResponse.json()) as {
            HTML?: string;
            Text?: string;
          };
          const content =
            `${detail.HTML ?? ""}\n${detail.Text ?? ""}`.replaceAll(
              "&amp;",
              "&",
            );
          const link = content.match(
            /https?:\/\/[^\s"'<>]+\/auth\/callback\?token_hash=[^\s"'<>]+/i,
          )?.[0];
          if (link) {
            return link;
          }
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Mailpit no recibió el enlace de recuperación esperado.");
}
