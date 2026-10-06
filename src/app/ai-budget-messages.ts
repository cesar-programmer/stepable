import type { BudgetLimit } from "@/modules/usage/contract";

/**
 * Shown when a consumption limit stopped an AI call (RF-10). Only daily
 * limits reset by themselves; the global budget needs the operator.
 */
export const budgetMessages: Record<BudgetLimit, string> = {
  espacio:
    "Se alcanzó el límite diario de consumo estimado de IA de este espacio. Se restablece a las 00:00 UTC. Mientras tanto puedes consultar las fuentes.",
  usuario:
    "Alcanzaste tu límite diario de consultas al asistente y a la ayuda (cuenta todos tus espacios). Se restablece a las 00:00 UTC.",
  global:
    "Se agotó el presupuesto total de IA configurado para este prototipo. No se restablece solo: el operador debe ampliarlo. Las fuentes, las rutas y el progreso siguen disponibles.",
  sin_tarifa:
    "El modelo de IA configurado no tiene una tarifa registrada, así que no se usa. El operador debe configurarla.",
};
