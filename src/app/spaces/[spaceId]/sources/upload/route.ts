import { type NextRequest, NextResponse } from "next/server";

import { spaceIdSchema } from "@/modules/access/input";
import { uploadSource } from "@/modules/sources/service";

import { notFound, readSourceUpload, seeOther } from "../upload-request";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  const parsedSpaceId = spaceIdSchema.safeParse((await params).spaceId);
  if (!parsedSpaceId.success) return notFound();
  const spaceId = parsedSpaceId.data;
  const returnPath = `/spaces/${spaceId}/sources`;

  const upload = await readSourceUpload(request, spaceId, returnPath);
  if (upload instanceof NextResponse) return upload;

  const result = await uploadSource(upload.dependencies, {
    identityId: upload.identityId,
    spaceId,
    fileName: upload.fileName,
    bytes: upload.bytes,
    title: upload.title,
  });

  if (result.kind === "queued") return seeOther(`${returnPath}?notice=queued`);
  if (result.kind === "unauthorized") return notFound();
  return seeOther(`${returnPath}?error=${encodeURIComponent(result.code)}`);
}
