import { z } from "zod";

import {
  markdownMaxBytes,
  sourceTitleMaxLength,
  type SourceFormat,
  type UploadRejectionCode,
} from "./contract.ts";

export const sourceIdentifiersSchema = z.object({
  spaceId: z.uuid(),
  sourceId: z.uuid(),
});

export type ValidatedSourceUpload =
  | { ok: true; title: string; format: SourceFormat; contentType: string }
  | { ok: false; code: UploadRejectionCode };

const markdownExtension = /\.(md|markdown)$/i;

function normalizeTitle(value: string): string {
  return value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateSourceUpload(input: {
  fileName: string;
  byteSize: number;
  title?: string | null;
}): ValidatedSourceUpload {
  if (!markdownExtension.test(input.fileName)) {
    return { ok: false, code: "formato_no_admitido" };
  }
  if (input.byteSize <= 0) {
    return { ok: false, code: "archivo_vacio" };
  }
  if (input.byteSize > markdownMaxBytes) {
    return { ok: false, code: "archivo_demasiado_grande" };
  }

  const requestedTitle = normalizeTitle(input.title ?? "");
  if (requestedTitle.length > sourceTitleMaxLength) {
    return { ok: false, code: "titulo_invalido" };
  }
  const fileTitle = normalizeTitle(
    input.fileName.replace(/^.*[\\/]/, "").replace(markdownExtension, ""),
  ).slice(0, sourceTitleMaxLength);
  const title = requestedTitle || fileTitle.trim() || "Documento sin título";

  return {
    ok: true,
    title,
    format: "markdown",
    contentType: "text/markdown",
  };
}
