import { createClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "../../lib/env.ts";
import type { InvitedIdentityGateway } from "../../modules/invitations/contract.ts";

export class SupabaseInvitedIdentityGateway implements InvitedIdentityGateway {
  async sendAccountSetup(email: string): Promise<"sent" | "failed"> {
    const environment = getServerEnvironment();
    const client = createClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { error } = await client.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${environment.STEPABLE_APP_URL}/auth/callback`,
    });
    return error ? "failed" : "sent";
  }
}
