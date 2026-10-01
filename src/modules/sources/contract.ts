import type { SpaceRole } from "../access/contract.ts";

export const markdownMaxBytes = 1024 * 1024;
export const pdfMaxBytes = 8 * 1024 * 1024;
export const pdfMaxPages = 200;
export const uploadMaxBytes = Math.max(markdownMaxBytes, pdfMaxBytes);
export const maxActiveSourcesPerSpace = 50;
export const maxExtractedCharacters = 2_000_000;
export const sourceTitleMaxLength = 120;

export const sourceVersionStatuses = [
  "en_cola",
  "procesando",
  "lista",
  "fallida",
  "reemplazada",
  "descartada",
] as const;
export const sourceFormats = ["markdown", "pdf"] as const;
export const sourceStatuses = ["activa", "eliminada"] as const;

export type SourceVersionStatus = (typeof sourceVersionStatuses)[number];
export type SourceFormat = (typeof sourceFormats)[number];

export const uploadRejectionCodes = [
  "formato_no_admitido",
  "archivo_demasiado_grande",
  "archivo_vacio",
  "titulo_invalido",
  "limite_de_fuentes",
  "almacenamiento_no_disponible",
] as const;
export type UploadRejectionCode = (typeof uploadRejectionCodes)[number];

export const processingErrorCodes = [
  "codificacion_invalida",
  "contenido_vacio",
  "texto_demasiado_extenso",
  "almacenamiento_no_disponible",
  "error_interno",
  "tiempo_agotado",
  "pdf_danado",
  "pdf_protegido",
  "demasiadas_paginas",
  "sin_texto_extraible",
  "pdf_demasiado_complejo",
] as const;
export type ProcessingErrorCode = (typeof processingErrorCodes)[number];

/** Markdown sections carry lines and headings; PDF sections carry a page. */
export type SourceSection = {
  ordinal: number;
  headingPath: string[];
  startLine: number | null;
  endLine: number | null;
  pageNumber: number | null;
  content: string;
};

export type ExtractionResult =
  | { ok: true; sections: SourceSection[]; pageCount: number | null }
  | { ok: false; code: ProcessingErrorCode };

export type PdfPageText = { pageNumber: number; text: string };

export type PdfExtractionResult =
  | { kind: "pages"; pageCount: number; pages: PdfPageText[] }
  | {
      kind: "rejected";
      code:
        | "pdf_danado"
        | "pdf_protegido"
        | "demasiadas_paginas"
        | "pdf_demasiado_complejo";
    }
  | { kind: "transient"; code: "tiempo_agotado" | "error_interno" };

export interface PdfTextExtractor {
  extract(bytes: Uint8Array): Promise<PdfExtractionResult>;
}

export type SourceSummary = {
  id: string;
  title: string;
  format: SourceFormat;
  versionNumber: number;
  status: SourceVersionStatus;
  errorCode: string | null;
  sectionCount: number | null;
  pageCount: number | null;
  updatedAt: Date;
};

export type SourceListing = {
  role: SpaceRole;
  canManage: boolean;
  sources: SourceSummary[];
};

export type SourceContent = {
  source: SourceSummary;
  sections: SourceSection[];
};

export type NewSourceVersion = {
  sourceId: string;
  versionId: string;
  spaceId: string;
  title: string;
  format: SourceFormat;
  byteSize: number;
  sha256: string;
  storageKey: string;
  createdBy: string;
};

export type CreateSourceResult =
  { kind: "created" } | { kind: "unauthorized" | "limite_de_fuentes" };

export type VersionForProcessing = {
  versionId: string;
  spaceId: string;
  storageKey: string;
  format: SourceFormat;
};

export interface SourceRepository {
  createSourceWithFirstVersion(
    input: NewSourceVersion,
  ): Promise<CreateSourceResult>;
  listSources(spaceId: string, onlyReady: boolean): Promise<SourceSummary[]>;
  findSource(
    spaceId: string,
    sourceId: string,
    onlyReady: boolean,
  ): Promise<SourceSummary | null>;
  listCurrentSections(
    spaceId: string,
    sourceId: string,
  ): Promise<SourceSection[]>;
  startProcessing(versionId: string): Promise<VersionForProcessing | null>;
  completeProcessing(
    versionId: string,
    sections: SourceSection[],
    pageCount: number | null,
  ): Promise<boolean>;
  failProcessing(
    versionId: string,
    errorCode: ProcessingErrorCode,
  ): Promise<boolean>;
  failStaleProcessing(startedBefore: Date): Promise<number>;
}

export interface SourceFileStorage {
  upload(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  download(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

export class TransientProcessingError extends Error {
  readonly code: ProcessingErrorCode;

  constructor(code: ProcessingErrorCode, options?: { cause?: unknown }) {
    super(`Fallo transitorio de procesamiento: ${code}`, options);
    this.name = "TransientProcessingError";
    this.code = code;
  }
}
