import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnvironment } from "@/lib/env";

export async function verifySupabaseRecoveryRequest(
  request: NextRequest,
  tokenHash: string,
  response: NextResponse,
): Promise<boolean> {
  const environment = getPublicEnvironment();
  const client = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  return !error;
}
