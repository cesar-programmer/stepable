export const accessAuditActions = [
  "espacio_creado",
  "invitacion_creada",
  "invitacion_reenviada",
  "invitacion_cancelada",
  "invitacion_aceptada",
  "rol_membresia_cambiado",
  "membresia_retirada",
  "membresia_abandonada",
  "fuente_cargada",
  "fuente_reemplazada",
  "procesamiento_reintentado",
  "fuente_eliminada",
  "borrador_eliminado",
] as const;

export const accessAuditActorTypes = ["identidad", "operador"] as const;
export const accessAuditTargetTypes = [
  "espacio",
  "invitacion",
  "membresia",
  "fuente",
  "ruta",
] as const;

export type AccessAuditAction = (typeof accessAuditActions)[number];
export type AccessAuditActorType = (typeof accessAuditActorTypes)[number];
export type AccessAuditTargetType = (typeof accessAuditTargetTypes)[number];
