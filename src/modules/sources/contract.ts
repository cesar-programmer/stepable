import type { SpaceRole } from "../access/contract.ts";

export const markdownMaxBytes = 1024 * 1024;
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
] as const;
export type ProcessingErrorCode = (typeof processingErrorCodes)[number];

export type MarkdownSection = {
  ordinal: number;
  headingPath: string[];
  startLine: number;
  endLine: number;
  content: string;
};

export type SourceSummary = {
  id: string;
  title: string;
  format: SourceFormat;
  versionNumber: number;
  status: SourceVersionStatus;
  errorCode: string | null;
  sectionCount: number | null;
  updatedAt: Date;
};

export type SourceListing = {
  role: SpaceRole;
  canManage: boolean;
  sources: SourceSummary[];
};

export type SourceContent = {
  source: SourceSummary;
  sections: MarkdownSection[];
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
  ): Promise<MarkdownSection[]>;
  startProcessing(versionId: string): Promise<VersionForProcessing | null>;
  completeProcessing(
    versionId: string,
    sections: MarkdownSection[],
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
