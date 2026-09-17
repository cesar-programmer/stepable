# ADR-002 · Organización modular y procesamiento en segundo plano

Fecha: 2026-09-17 · Estado: aceptado.

## Contexto

Un solo desarrollador construye un piloto con fuentes, generación de rutas, consultas y progreso. La ingesta y generación pueden tardar más que una interacción web. Se necesita recuperar fallos y mantener coherentes permisos y versiones.

## Alternativas

1. Ejecutar todo dentro de solicitudes web: pocas piezas, pero las tareas largas y su recuperación quedan mal resueltas.
2. Backend modular con API y worker compartiendo código: conserva reglas juntas y permite trabajos persistentes.
3. Servicios independientes por módulo: añade contratos de red, operación distribuida y despliegues sin evidencia actual que lo justifique.

## Decisión

Adoptar la segunda opción. Organizar responsabilidades de acceso, fuentes, conocimiento, rutas, aprendizaje, conversaciones y operación. Una base transaccional para estado del negocio; archivos privados e índice reconstruible. Web/API comparten proceso en E1 y el worker se incorpora desde E2. Hosting y proveedor de IA siguen pendientes.

La descripción canónica está en [04-arquitectura](../04-arquitectura.md). Esta propuesta no modifica las exclusiones de [02-alcance-v0](../02-alcance-v0.md).

## Consecuencias

- API y worker deben compartir reglas y tener versiones de código compatibles.
- Necesitamos trabajos recuperables y resultados idempotentes, sin asumir ejecución externa exactamente una vez.
- Los módulos tienen fronteras de código, no despliegues propios.
- La separación interna exige disciplina; una base compartida no autoriza escrituras entre módulos sin coordinación explícita.
- La operación real y los costos quedan pendientes del stack y volumen piloto.

## Fundamento y revisión

Propuesta elaborada durante la planificación y aceptada expresamente por el usuario el 2026-09-17 para desarrollo local: arquitectura modular, web/API juntas y worker desde E2. No constituye aprobación de proveedores, despliegue, costos ni reglas de acceso. No hay mediciones de carga.

## Referencias

[Microsoft: separación lógica y arquitectura web](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures). La elección para Stepable es un juicio de diseño, no una recomendación específica de esa fuente sobre este producto.
