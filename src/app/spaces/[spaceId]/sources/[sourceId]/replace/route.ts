import { type NextRequest, NextResponse } from "next/server";

import { sourceIdentifiersSchema } from "@/modules/sources/input";
import { replaceSourceFile } from "@/modules/sources/service";

import { notFound, readSourceUpload, seeOther } from "../../upload-request";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string; sourceId: string }> },
) {
  const parsed = sourceIdentifiersSchema.safeParse(await params);
  if (!parsed.success) return notFound();
  const { spaceId, sourceId } = parsed.data;
  const returnPath = `/spaces/${spaceId}/sources/${sourceId}`;

  const upload = await readSourceUpload(request, spaceId, returnPath);
  if (upload instanceof NextResponse) return upload;

  const result = await replaceSourceFile(upload.dependencies, {
    identityId: upload.identityId,
    spaceId,
    sourceId,
    fileName: upload.fileName,
    bytes: upload.bytes,
  });

  if (result.kind === "queued") {
    return seeOther(`${returnPath}?notice=replacement_queued`);
  }
  if (result.kind === "unauthorized" || result.kind === "not_found") {
    return notFound();
  }
  return seeOther(`${returnPath}?error=${encodeURIComponent(result.code)}`);
}
