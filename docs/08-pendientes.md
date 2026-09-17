# Decisiones pendientes

Estado: abierto · Actualizado: 2026-09-17.

| ID | Pregunta | Resolver antes de |
| --- | --- | --- |
| PEN-01 | Presupuesto orientativo confirmado: 10 USD/mes para primeras pruebas. Correo externo, dominios, alojamiento y costos se reevalúan sin proveedor elegido | Preparar/autorizar piloto |
| PEN-02 | Revisar acceso solo por invitación, Supabase Auth, recuperación, token de 7 días y aprovisionamiento privado por operador sin contraseña predeterminada (ADR-003; RN-08, RN-10, RN-13–RN-15, RN-18) | E1.0 |
| PEN-03 | Cómo aprobar, reintentar, desbloquear pasos y aceptar variantes de código | E5 |
| PEN-04 | Fuente vigente, contradicciones, sustitución, eliminación y rutas obsoletas | E2/E3, completar antes de E4 |
| PEN-05 | Revisar responsables múltiples, protección del último responsable, espacios nuevos solo por operador y revocación efectiva tras commit sin cerrar sesión global (ADR-003; RN-09–RN-12, RN-16–RN-17). Visibilidad de fuentes se confirma en E2 | E1.0/E2 |
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
