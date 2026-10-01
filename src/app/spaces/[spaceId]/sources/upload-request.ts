import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { authorizeSpaceAction } from "@/modules/access/authorization";
import { uploadMaxBytes } from "@/modules/sources/contract";

import { sourceUploadDependencies } from "./dependencies";

// Room for multipart boundaries, part headers and the title field.
const multipartOverheadBytes = 64 * 1024;

type UploadDependencies = Awaited<ReturnType<typeof sourceUploadDependencies>>;

export type UploadedFile = {
  identityId: string;
  dependencies: UploadDependencies;
  fileName: string;
  bytes: Uint8Array;
  title: string | null;
};

// Same check Next applies to Server Actions: the browser Origin must match Host.
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

// Relative Location keeps the browser on the host it used, with its cookies.
export function seeOther(location: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "private, no-store" },
  });
}

export function notFound() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Shared HTTP boundary for source uploads: same-origin check, identity,
 * gestionar_fuentes before reading the body, and size limits. Returns either
 * the parsed file or the response to send.
 */
export async function readSourceUpload(
  request: NextRequest,
  spaceId: string,
  returnPath: string,
): Promise<UploadedFile | NextResponse> {
  if (!isSameOrigin(request)) {
    return new NextResponse(null, { status: 403 });
  }
  const back = (code: string) =>
    seeOther(`${returnPath}?error=${encodeURIComponent(code)}`);

  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) {
    return seeOther(`/login?next=${encodeURIComponent(returnPath)}`);
  }

  const dependencies = await sourceUploadDependencies();
  // Reject before reading the body; the repository revalidates in its transaction.
  if (
    !(await authorizeSpaceAction(
      dependencies.accessRepository,
      identity.id,
      spaceId,
      "gestionar_fuentes",
    ))
  ) {
    return notFound();
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > uploadMaxBytes + multipartOverheadBytes) {
    return back("archivo_demasiado_grande");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back("solicitud_invalida");
  }
  const file = form.get("file");
  const title = form.get("title");
  if (!(file instanceof File)) {
    return back("solicitud_invalida");
  }
  if (file.size > uploadMaxBytes) {
    return back("archivo_demasiado_grande");
  }

  return {
    identityId: identity.id,
    dependencies,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    title: typeof title === "string" ? title : null,
  };
}
