import { z } from "zod";

import {
  markdownMaxBytes,
  pdfMaxBytes,
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

const formats: {
  format: SourceFormat;
  extension: RegExp;
  maxBytes: number;
  contentType: string;
}[] = [
  {
    format: "markdown",
    extension: /\.(md|markdown)$/i,
    maxBytes: markdownMaxBytes,
    contentType: "text/markdown",
  },
  {
    format: "pdf",
    extension: /\.pdf$/i,
    maxBytes: pdfMaxBytes,
    contentType: "application/pdf",
  },
];

const pdfSignature = new TextEncoder().encode("%PDF-");

// PDF readers accept the header anywhere in the first 1024 bytes.
function hasPdfSignature(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 1024) - pdfSignature.length;
  for (let offset = 0; offset <= limit; offset += 1) {
    if (pdfSignature.every((value, index) => bytes[offset + index] === value)) {
      return true;
    }
  }
  return false;
}

function normalizeTitle(value: string): string {
  return value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateSourceUpload(input: {
  fileName: string;
  byteSize: number;
  leadingBytes: Uint8Array;
  title?: string | null;
}): ValidatedSourceUpload {
  const format = formats.find((candidate) =>
    candidate.extension.test(input.fileName),
  );
  if (!format) {
    return { ok: false, code: "formato_no_admitido" };
  }
  if (input.byteSize <= 0) {
    return { ok: false, code: "archivo_vacio" };
  }
  if (input.byteSize > format.maxBytes) {
    return { ok: false, code: "archivo_demasiado_grande" };
  }
  if (format.format === "pdf" && !hasPdfSignature(input.leadingBytes)) {
    return { ok: false, code: "formato_no_admitido" };
  }

  const requestedTitle = normalizeTitle(input.title ?? "");
  if (requestedTitle.length > sourceTitleMaxLength) {
    return { ok: false, code: "titulo_invalido" };
  }
  const fileTitle = normalizeTitle(
    input.fileName.replace(/^.*[\\/]/, "").replace(format.extension, ""),
  ).slice(0, sourceTitleMaxLength);
  const title = requestedTitle || fileTitle.trim() || "Documento sin título";

  return {
    ok: true,
    title,
    format: format.format,
    contentType: format.contentType,
  };
}
