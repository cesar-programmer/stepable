export const accessAuditActions = [
  "espacio_creado",
  "invitacion_creada",
  "invitacion_reenviada",
  "invitacion_cancelada",
  "invitacion_aceptada",
  "rol_membresia_cambiado",
  "membresia_retirada",
  "membresia_abandonada",
] as const;

export const accessAuditActorTypes = ["identidad", "operador"] as const;
export const accessAuditTargetTypes = [
  "espacio",
  "invitacion",
  "membresia",
] as const;

export type AccessAuditAction = (typeof accessAuditActions)[number];
export type AccessAuditActorType = (typeof accessAuditActorTypes)[number];
export type AccessAuditTargetType = (typeof accessAuditTargetTypes)[number];
