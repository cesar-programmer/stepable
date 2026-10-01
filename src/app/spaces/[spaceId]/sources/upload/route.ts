import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";
import { authorizeSpaceAction } from "@/modules/access/authorization";
import { spaceIdSchema } from "@/modules/access/input";
import { uploadMaxBytes } from "@/modules/sources/contract";
import { uploadSource } from "@/modules/sources/service";

import { sourceUploadDependencies } from "../dependencies";

// Room for multipart boundaries, part headers and the title field.
const multipartOverheadBytes = 64 * 1024;

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
function seeOther(location: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "private, no-store" },
  });
}

function notFound() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  const parsedSpaceId = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsedSpaceId.success) return notFound();
  const spaceId = parsedSpaceId.data;

  if (!isSameOrigin(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const back = (type: "error" | "notice", code: string) =>
    seeOther(`/spaces/${spaceId}/sources?${type}=${encodeURIComponent(code)}`);

  const identity = await (
    await createSupabaseIdentityGateway()
  ).currentIdentity();
  if (!identity) {
    return seeOther(
      `/login?next=${encodeURIComponent(`/spaces/${spaceId}/sources`)}`,
    );
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
    return back("error", "archivo_demasiado_grande");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back("error", "solicitud_invalida");
  }
  const file = form.get("file");
  const title = form.get("title");
  if (!(file instanceof File)) {
    return back("error", "solicitud_invalida");
  }
  if (file.size > uploadMaxBytes) {
    return back("error", "archivo_demasiado_grande");
  }

  const result = await uploadSource(dependencies, {
    identityId: identity.id,
    spaceId,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    title: typeof title === "string" ? title : null,
  });

  if (result.kind === "queued") return back("notice", "queued");
  if (result.kind === "unauthorized") return notFound();
  return back("error", result.code);
}
