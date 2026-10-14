# ADR-013 · Eliminar borradores de rutas

- **Fecha:** 2026-10-13
- **Estado:** propuesto (implementado en local, pendiente de revisión del usuario)

## Contexto

El usuario pidió poder borrar desde Inicio los borradores que ya no quiere. Hasta ahora solo se podían eliminar pasos. Además, los intentos de generación (`route_generation_attempts`) se borraban en cascada con su ruta: eliminar la ruta tal cual habría devuelto intentos del límite diario.

## Alternativas

1. Borrado físico del borrador con conservación de los intentos (elegida).
2. Archivo o papelera. Añade estados y pantallas que nadie pidió; queda como posible evolución.
3. Permitir también eliminar rutas publicadas. Se descarta: perdería el progreso de los integrantes (RN-32) y requiere decidir antes qué pasa con él.

## Decisión

- RN-40: solo responsables activos, solo borradores, con confirmación y sin papelera. Disponible en Inicio, Rutas y la cabecera del borrador.
- **Generaciones:** no se elimina mientras la generación está en curso. Uno en cola sí, porque el worker ya omite una ruta que no puede reclamar.
- **Migración `20261013000000_route_draft_deletion.sql`:**
  - `route_generation_attempts.route_id` pasa a ser opcional, con `on delete set null`; los intentos siguen contando;
  - nuevos valores de auditoría `borrador_eliminado` y `ruta`.

## Consecuencias

- Borrar no devuelve intentos ni consumo de IA.
- La auditoría registra quién eliminó qué borrador.
- Las rutas publicadas siguen sin poder retirarse; queda como pendiente (PEN-13).

## Documentos afectados

`03-flujos-y-reglas.md` (RN-40), `05-datos-y-permisos.md` y `11-interfaz.md`.
