# Decisiones pendientes

Estado: abierto · Actualizado: 2026-10-01.

| ID | Pregunta | Resolver antes de |
| --- | --- | --- |
| PEN-01 | Presupuesto orientativo confirmado: 10 USD/mes para primeras pruebas. Correo externo, dominios, alojamiento y costos se reevalúan sin proveedor elegido | Preparar/autorizar piloto |
| PEN-02 | Identidad, invitaciones y revisión de seguridad local resueltas hasta E1.7. Falta completar RN-18 para operación externa: límites, correo y respuestas del entorno de piloto sin enumeración | Antes del piloto |
| PEN-03 | Cómo aprobar, reintentar, desbloquear pasos y aceptar variantes de código | E5 |
| PEN-04 | Fuente vigente, contradicciones, sustitución, eliminación y rutas obsoletas. Vigencia, reemplazo, reintento y eliminación aplicados en E2.1–E2.4 (RN-19–RN-25). Siguen abiertos las contradicciones entre fuentes y el destino de citas, lecciones o rutas que referencien versiones reemplazadas o eliminadas: debe resolverse antes de implementarlas | E3/E4 |
| PEN-06 | Retención, eliminación, acceso operativo y datos enviados a proveedores. Política local de fuentes aceptada (documento 05). Para E3, el usuario autorizó enviar solo preguntas y fragmentos sintéticos al proveedor que apruebe. Siguen abiertos los plazos para datos reales, el acceso operativo y las condiciones del proveedor | Antes del piloto |
| PEN-07 | Stack local, Storage, `pg-boss`, `pdfjs-dist` y la recuperación híbrida de E3 resueltos (ADR-003–ADR-005). Para el prototipo local, el usuario eligió OpenAI `gpt-4.1-mini` (conversación) y `text-embedding-3-small` (embeddings). Siguen abiertos los servicios alojados del piloto | Piloto |
| PEN-08 | Límites de archivos, consumo, latencias y umbrales de calidad. Límites de fuentes aplicados en E2 y límites por consulta en E3 (04 §20). Siguen abiertos el límite de gasto, el umbral de similitud, las latencias y los criterios de calidad del asistente | Evaluación real de E3 y piloto |
| PEN-09 | Quién probará, con qué documentación autorizada y qué objetivo de aprendizaje | Preparar piloto |
| PEN-12 | Limpieza de objetos huérfanos en Storage (originales subidos cuya transacción no confirmó). Aceptado el 2026-10-01 como limitación del prototipo local con documentos sintéticos; distinto de la purga de fuentes eliminadas, ya implementada | Antes de usar documentación real o desplegar |
| PEN-10 | Producto de Atlassian usado: Confluence o Jira | Planear integración futura; no bloquea V0 manual |

Al resolver: registrar respuesta y fundamento en el documento canónico; para decisiones significativas crear ADR y enlazarlo aquí. No borrar el historial ni registrar una propuesta como aceptación del usuario.

## Restricción confirmada de presupuesto

El usuario indicó unos 10 USD como presupuesto total mensual de primeras pruebas, sin compromiso de contratación. La etapa actual es exclusivamente local y no tiene proveedores contratados. Distribución, correo externo, dominio, alojamiento y suficiencia del presupuesto quedan pendientes del piloto.

## Resueltas

- PEN-11 · 2026-09-17: ADR-002 aceptado; backend modular, web/API juntas en E1 y worker desde E2.
- Parte local de PEN-07 · 2026-09-17: TypeScript/Next.js/`pnpm`/Zod/PostgreSQL/Drizzle/Vitest/Playwright y una sola pila Supabase CLI aceptados; versiones fijadas y E1.1 verificada.
- Parte de identidad de PEN-02 · 2026-09-17: Supabase Auth local con correo/contraseña, login/logout, recuperación por Mailpit, validación en servidor y registro público bloqueado aceptados e implementados en E1.2. Las invitaciones permanecen abiertas.
- Parte de acceso de PEN-02/PEN-05 · 2026-09-17: aceptados e implementados en E1.3 perfiles vinculados a identidades existentes, membresía única por usuario/espacio, roles por espacio, responsables múltiples, bootstrap privado solo por operador y aislamiento de listado/detalle por membresía. En ese cierre quedaron abiertas invitaciones, administración concurrente y revocación completa.
- Parte de autorización de PEN-05 · 2026-09-18: aceptadas e implementadas en E1.4 la matriz mínima, la denegación por defecto, la consulta de membresía/rol por solicitud, la conservación como revocada y la vigencia posterior al commit. Los cambios/retiros administrativos concurrentes siguen en E1.6.
- Parte local de invitaciones de PEN-02/PEN-05 · 2026-09-18: aceptados e implementados en E1.5 siete días de vigencia, rol integrante predeterminado, responsable explícito, cuenta Auth separada de aceptación Stepable, reactivación de revocadas y preservación del rol activo. También se implementaron creación/lista/reenvío/cancelación solo por responsable, token hasheado de un uso y aceptación atómica. RN-18 no queda aceptada en bloque; su endurecimiento externo permanece abierto.
- PEN-05 · 2026-09-19: aceptada e implementada en E1.6 la administración local. Un responsable activo puede promover, degradar o retirar miembros —incluido otro responsable o a sí mismo— si permanece un responsable activo; un integrante solo puede abandonar su propia membresía. Revocadas se listan pero no se mutan ni reactivan directamente. Las operaciones se serializan por espacio y revalidan al actor y el invariante dentro de la transacción. La visibilidad de fuentes se definirá con E2, sin reabrir estas reglas de membresía.
- Cierre local de E1 · 2026-09-21: E1.7 implementa auditoría transaccional mínima, higiene del repositorio, revisión de credenciales en navegador y operación reproducible. No abre una decisión nueva: PEN-06 conserva la retención antes de datos reales y PEN-02 conserva solo el endurecimiento externo de RN-18.
