# Decisiones pendientes

Estado: abierto · Actualizado: 2026-09-18.

| ID | Pregunta | Resolver antes de |
| --- | --- | --- |
| PEN-01 | Presupuesto orientativo confirmado: 10 USD/mes para primeras pruebas. Correo externo, dominios, alojamiento y costos se reevalúan sin proveedor elegido | Preparar/autorizar piloto |
| PEN-02 | Identidad y bootstrap local resueltos hasta E1.3. Falta aprobar el mecanismo de invitación de Stepable, su vigencia y comportamiento no enumerable (parte restante de RN-08, RN-13–RN-15, RN-18) | Antes de E1.5 |
| PEN-03 | Cómo aprobar, reintentar, desbloquear pasos y aceptar variantes de código | E5 |
| PEN-04 | Fuente vigente, contradicciones, sustitución, eliminación y rutas obsoletas | E2/E3, completar antes de E4 |
| PEN-05 | E1.4 resolvió matriz mínima, consulta vigente, membresía revocada y efecto posterior al commit. Faltan endpoints y concurrencia de cambios/retiros de RN-12/RN-16 en E1.6; visibilidad de fuentes se confirma en E2 | E1.6/E2 según la regla |
| PEN-06 | Retención, eliminación, acceso operativo y datos enviados a proveedores | E2/E3 |
| PEN-07 | Stack local y Supabase CLI resueltos en ADR-003. Siguen abiertos jobs, archivos, búsqueda/IA y todos los servicios alojados del piloto | Antes de cada entrega afectada/piloto |
| PEN-08 | Límites de archivos, consumo, latencias y umbrales de calidad | Entregas afectadas y piloto |
| PEN-09 | Quién probará, con qué documentación autorizada y qué objetivo de aprendizaje | Preparar piloto |
| PEN-10 | Producto de Atlassian usado: Confluence o Jira | Planear integración futura; no bloquea V0 manual |

Al resolver: registrar respuesta y fundamento en el documento canónico; para decisiones significativas crear ADR y enlazarlo aquí. No borrar el historial ni registrar una propuesta como aceptación del usuario.

## Restricción confirmada de presupuesto

El usuario indicó unos 10 USD como presupuesto total mensual de primeras pruebas, sin compromiso de contratación. La etapa actual es exclusivamente local y no tiene proveedores contratados. Distribución, correo externo, dominio, alojamiento y suficiencia del presupuesto quedan pendientes del piloto.

## Resueltas

- PEN-11 · 2026-09-17: ADR-002 aceptado; backend modular, web/API juntas en E1 y worker desde E2.
- Parte local de PEN-07 · 2026-09-17: TypeScript/Next.js/`pnpm`/Zod/PostgreSQL/Drizzle/Vitest/Playwright y una sola pila Supabase CLI aceptados; versiones fijadas y E1.1 verificada.
- Parte de identidad de PEN-02 · 2026-09-17: Supabase Auth local con correo/contraseña, login/logout, recuperación por Mailpit, validación en servidor y registro público bloqueado aceptados e implementados en E1.2. Las invitaciones permanecen abiertas.
- Parte de acceso de PEN-02/PEN-05 · 2026-09-17: aceptados e implementados en E1.3 perfiles vinculados a identidades existentes, membresía única por usuario/espacio, roles por espacio, responsables múltiples, bootstrap privado solo por operador y aislamiento de listado/detalle por membresía. En ese cierre quedaron abiertas invitaciones, administración concurrente y revocación completa.
- Parte de autorización de PEN-05 · 2026-09-18: aceptadas e implementadas en E1.4 la matriz mínima, la denegación por defecto, la consulta de membresía/rol por solicitud, la conservación como revocada y la vigencia posterior al commit. Reincorporación, endpoints y operaciones concurrentes siguen en E1.5/E1.6.
