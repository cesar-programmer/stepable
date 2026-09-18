import { type NextRequest, NextResponse } from "next/server";

import { verifySupabaseRecoveryRequest } from "@/adapters/supabase/recovery-route";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (tokenHash && type === "recovery") {
    const response = new NextResponse(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Recuperación verificada</title></head><body><p>Recuperación verificada. Continuando…</p><p><a href="/auth/update-password">Continuar</a></p><script>window.location.replace("/auth/update-password")</script></body></html>`,
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "text/html; charset=utf-8",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
    if (await verifySupabaseRecoveryRequest(request, tokenHash, response)) {
      return response;
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=invalid-link", request.url),
  );
}
