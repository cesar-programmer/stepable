import { type NextRequest, NextResponse } from "next/server";

import { verifySupabaseEmailOtpRequest } from "@/adapters/supabase/recovery-route";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (tokenHash && (type === "recovery" || type === "invite")) {
    const next = type === "invite" ? "/invitations/accept" : "/protected";
    const destination = `/auth/update-password?next=${encodeURIComponent(next)}`;
    const response = new NextResponse(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Identidad verificada</title></head><body><p>Identidad verificada. Continuando…</p><p><a href="${destination}">Continuar</a></p><script>window.location.replace(${JSON.stringify(destination)})</script></body></html>`,
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "text/html; charset=utf-8",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
    if (
      await verifySupabaseEmailOtpRequest(request, tokenHash, type, response)
    ) {
      return response;
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=invalid-link", request.url),
  );
}
