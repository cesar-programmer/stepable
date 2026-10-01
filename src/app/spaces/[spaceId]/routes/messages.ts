export const routeGenerationLabels: Record<string, string> = {
  en_cola: "En cola",
  generando: "Generando",
  lista: "Borrador listo",
  insuficiente: "Evidencia insuficiente",
  fallida: "Falló",
};

export const routeErrorMessages: Record<string, string> = {
  invalid:
    "Revisa los datos: objetivo de 10 a 500 caracteres, de 1 a 5 fuentes, textos no vacíos, 3 o 4 opciones distintas, una respuesta correcta y solo citas [n] existentes en el paso.",
  fuentes_no_disponibles:
    "Alguna fuente seleccionada ya no está lista o no pertenece al espacio.",
  generacion_en_curso: "Ya hay una generación en curso para esta ruta.",
  limite_diario:
    "Se alcanzó el máximo de 5 intentos de generación del espacio por día (UTC).",
  not_editable: "La ruta ya no se puede editar.",
  conflict:
    "La ruta cambió mientras la editabas. Recarga la página y repite el cambio.",
  citas_no_vigentes:
    "Hay citas a versiones que ya no están vigentes. Regenera el borrador o elimina los pasos afectados antes de publicar.",
  sin_pasos: "La ruta necesita al menos un paso para publicarse.",
  modelo_no_configurado:
    "El modelo de conversación no está configurado en el servidor.",
  modelo_no_disponible:
    "El modelo no respondió. Puedes regenerar (cuenta como un intento).",
  borrador_no_valido:
    "El modelo devolvió un borrador que no supera la validación (estructura o citas). Puedes regenerar.",
  tiempo_agotado: "La generación no terminó a tiempo. Puedes regenerar.",
};

export const routeNoticeMessages: Record<string, string> = {
  generation_queued: "Generación en cola. El borrador aparecerá aquí.",
  step_saved: "Paso guardado.",
  step_moved: "Paso movido.",
  step_deleted: "Paso eliminado.",
  route_published: "Ruta publicada. Esta versión ya no cambia.",
};

export const citationStateLabels: Record<string, string> = {
  vigente: "vigente",
  version_anterior: "versión anterior: la fuente fue reemplazada",
  fuente_eliminada: "fuente eliminada",
};
