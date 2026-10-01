# ADR-007 · Recorrido de rutas publicadas (E5.1)

Fecha: 2026-10-01 · Estado: **aceptado** para el prototipo local en E5.1 y E5.2 (comprobaciones manuales del usuario).

## Contexto

E5 cubre RF-06/RF-07 y CA-05. El usuario aprobó el recorrido mínimo: empezar una ruta publicada, responder, recibir retroalimentación y retomar el progreso, con cinco reglas que resuelven la parte de PEN-03 para opción múltiple. No requiere IA.

## Decisión

1. Hasta 3 intentos por pregunta. Tras un fallo no se revela la respuesta.
2. La respuesta correcta y la explicación se muestran, y se envían al navegador, solo al acertar o al agotar los intentos.
3. Avance secuencial: el siguiente paso se desbloquea al resolver el actual, aunque se hayan agotado los intentos.
4. La ruta queda **completada** cuando todos los pasos están **resueltos**, sin nota mínima. El resultado cuenta los pasos **acertados** dentro de los intentos permitidos, no los envíos. Completar no implica dominio del contenido.
5. El progreso pertenece a la versión publicada recorrida. Una ruta marcada “Revisar” puede continuarse, con el aviso visible.

**Implementación:**
- `route_progress` (una fila por miembro y ruta, con la marca de la versión publicada) y `route_step_attempts`;
- el estado de cada paso, el paso actual y la finalización se derivan de los intentos;
- corrección en el servidor, en una transacción que revalida la membresía y bloquea el progreso del miembro;
- el identificador de envío único hace que un doble envío devuelva el resultado guardado sin contar otro intento;
- el progreso solo se lee para el propio usuario.

## Alternativas consideradas

- **Bloquear el avance hasta acertar:** descartada; podría dejar a una persona sin salida.
- **Revelar la respuesta tras el primer fallo:** descartada; reduce el valor de los reintentos.
- **Contar envíos como resultado:** descartada; el usuario pidió contar pasos acertados.

## Consecuencias

- Sin reinicio de ruta: una vez resuelto, un paso no se puede repetir.
- La vista de progreso del equipo (RF-09) y el reinicio quedan para entregas posteriores.
- Retención del progreso para datos reales en PEN-06.

## Resolución de E5.2 (2026-10-01)

El usuario aprobó una vista de progreso del equipo por ruta publicada:
- **Acceso:** solo responsables activos, mediante la acción central `consultar_progreso_equipo`, comprobada en el servidor.
- **Contenido:** resumen de miembros activos, cuántos empezaron y cuántos completaron, y una fila por miembro activo, responsables incluidos y ordenados por nombre (correo), con estado, pasos resueltos, pasos acertados, inicio y finalización.
- **Límites:** solo totales por persona, sin respuestas ni detalle por paso. Los retirados se ocultan y su progreso se conserva. Solo cuenta el progreso de la versión publicada actual; no se mezclan versiones.
- **Significados:** “No empezada” significa que no hay progreso registrado, no que exista una asignación obligatoria. La vista recuerda que completar no implica dominio.
- **Alcance:** solo lectura, sin IA, rankings, gráficos ni exportación.
