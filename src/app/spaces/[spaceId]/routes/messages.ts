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
  publicada:
    "Las rutas publicadas no se eliminan: conservan el progreso de quienes las recorren.",
  generando:
    "El borrador se está generando. Espera a que termine para eliminarlo.",
  modelo_no_configurado:
    "El modelo de conversación no está configurado en el servidor.",
  modelo_no_disponible:
    "El modelo no respondió. Puedes regenerar (cuenta como un intento).",
  borrador_no_valido:
    "El modelo devolvió un borrador que no supera la validación (estructura o citas). Puedes regenerar.",
  tiempo_agotado: "La generación no terminó a tiempo. Puedes regenerar.",
  limite_consumo_espacio:
    "Se alcanzó el límite diario de consumo estimado de IA de este espacio, así que no se llamó al modelo ni se gastó un intento de generación. Se restablece a las 00:00 UTC.",
  limite_consumo_global:
    "Se agotó el presupuesto total de IA configurado para este prototipo, así que no se llamó al modelo ni se gastó un intento. No se restablece solo: el operador debe ampliarlo.",
  tarifa_no_configurada:
    "El modelo de IA configurado no tiene una tarifa registrada, así que no se llamó. El operador debe configurarla.",
  solucion_visible:
    "El borrador generado mostraba la solución de un ejercicio de completar en su lección o su pregunta, así que no se aceptó. No se reintentó automáticamente; puedes regenerar (cuenta como un intento).",
  tipos_no_cubiertos:
    "El borrador generado no incluyó al menos un paso de cada tipo de actividad solicitado, así que no se aceptó. No se reintentó automáticamente; puedes regenerar (cuenta como un intento) o pedir otros tipos en una ruta nueva.",
};

export const routeNoticeMessages: Record<string, string> = {
  generation_queued: "Generación en cola. El borrador aparecerá aquí.",
  request_saved:
    "Cambios guardados. Todavía no se generó nada: pulsa «Generar con estos cambios» cuando quieras.",
  step_saved: "Paso guardado.",
  step_moved: "Paso movido.",
  step_deleted: "Paso eliminado.",
  route_published: "Ruta publicada. Esta versión ya no cambia.",
  draft_deleted:
    "Borrador eliminado. Los intentos de generación ya usados hoy siguen contando.",
};

export const citationStateLabels: Record<string, string> = {
  vigente: "vigente",
  version_anterior: "versión anterior: la fuente fue reemplazada",
  fuente_eliminada: "fuente eliminada",
};

export const requestedActivityLabels: Record<string, string> = {
  opcion_multiple: "Opción múltiple",
  lectura_codigo: "Lectura de código",
  completar: "Completar código",
};

/** One readable state per route, for lists and headers. */
export function routeState(route: {
  status: string;
  generationStatus: string;
}): { label: string; tone: string } {
  if (route.status === "publicada")
    return { label: "Publicada", tone: "success" };
  switch (route.generationStatus) {
    case "en_cola":
    case "generando":
      return { label: "Generando borrador", tone: "info" };
    case "insuficiente":
      return { label: "Sin evidencia suficiente", tone: "warning" };
    case "fallida":
      return { label: "La generación falló", tone: "danger" };
    default:
      return { label: "Borrador", tone: "brand" };
  }
}
