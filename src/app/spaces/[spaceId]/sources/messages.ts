import type {
  SourceFormat,
  SourceVersionStatus,
} from "@/modules/sources/contract";

export const sourceStatusLabels: Record<SourceVersionStatus, string> = {
  en_cola: "En cola",
  procesando: "Procesando",
  lista: "Lista",
  fallida: "Falló",
  reemplazada: "Reemplazada",
  descartada: "Descartada",
};

export const sourceFormatLabels: Record<SourceFormat, string> = {
  markdown: "Markdown",
  pdf: "PDF",
};

export const sourceErrorMessages: Record<string, string> = {
  formato_no_admitido:
    "Solo se admiten archivos Markdown (.md, .markdown) y PDF (.pdf) válidos.",
  archivo_demasiado_grande:
    "El archivo supera el límite: 1 MiB para Markdown y 8 MiB para PDF.",
  archivo_vacio: "El archivo está vacío.",
  titulo_invalido: "El título debe tener como máximo 120 caracteres.",
  limite_de_fuentes: "El espacio alcanzó el límite de 50 fuentes activas.",
  solicitud_invalida: "No se recibió un archivo válido.",
  codificacion_invalida: "El archivo no es texto UTF-8 válido.",
  contenido_vacio: "El archivo no contiene texto.",
  texto_demasiado_extenso: "El texto supera el máximo admitido.",
  almacenamiento_no_disponible:
    "No se pudo guardar o leer el archivo. Inténtalo de nuevo.",
  error_interno: "Se produjo un error interno al procesar la fuente.",
  tiempo_agotado: "El procesamiento no terminó a tiempo.",
  pdf_danado: "El PDF está dañado o no se puede leer.",
  pdf_protegido:
    "El PDF está cifrado o protegido con contraseña. Solo se admiten PDF sin cifrar.",
  demasiadas_paginas: "El PDF supera el límite de 200 páginas.",
  sin_texto_extraible:
    "El PDF no contiene texto extraíble. Los documentos escaneados no se admiten porque no hay OCR.",
  pdf_demasiado_complejo: "El PDF es demasiado complejo para procesarlo.",
};

export const sourceNoticeMessages: Record<string, string> = {
  queued: "Fuente recibida. Se procesará en segundo plano.",
};
