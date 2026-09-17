# IA y evaluación

Estado: especificación inicial propuesta a partir del alcance.
Actualizado: 2026-09-17.

## Respuestas

Autorizar espacio y usuario → recuperar fragmentos elegibles → componer respuesta → comprobar referencias → presentar respuesta y fuentes, o insuficiencia/error.

Una cita debe resolver una fuente real y su versión, página o sección. Presencia de citas no demuestra por sí sola respaldo semántico. No presentar similitud vectorial como probabilidad de verdad.

Documentos y mensajes recuperados son contenido, no instrucciones para cambiar permisos o reglas del sistema. La política de fuentes contradictorias o antiguas se resuelve en PEN-04.

## Generación de rutas

Entradas: objetivo, fuentes seleccionadas y tipos de actividad permitidos. Salida: borrador estructurado con pasos, referencias, actividades, criterios y retroalimentación. Validar estructura y referencias antes de ofrecerlo a revisión. Publicación regida por RN-01.

## Actividades

- Opción múltiple y lectura: clave y explicación revisadas por responsable.
- Completar código: huecos y criterios acotados; definir variantes válidas antes de implementar.
- No ejecutar código de usuario en V0. No afirmar que un programa funciona por inspección del modelo.

## Conjunto de evaluación propuesto

Preparar material propio/autorizado sobre convenciones, APIs e íconos, con ejemplos de:

1. Pregunta directamente respondida por una fuente.
2. Pregunta que combina dos secciones.
3. Pregunta sin respuesta en el material.
4. Fuentes contradictorias o reemplazadas.
5. Intento de obtener información de otro espacio.
6. Texto documental que intenta dar órdenes al asistente.
7. Ruta con referencia inválida o respuesta de quiz equivocada.

Para cada caso conservar respuesta esperada, evidencia, comportamiento permitido y resultado obtenido. No se ha ejecutado ninguna evaluación.

## Medidas a recoger

Respaldo de afirmaciones, citas resolubles, reconocimiento de insuficiencia, correcciones del responsable, finalización de rutas, utilidad percibida, consumo y latencia. Los umbrales de cierre están pendientes PEN-08; no convertir estos nombres en resultados medidos.

## Integración propuesta en arquitectura v0.5

El [documento 04](04-arquitectura.md) ubica la ingesta y generación de rutas en un worker y las consultas del chat en la API. Propone operaciones explícitas para chat y generación; no requiere un agente autónomo para seleccionar acciones. La selección de modelos, el rendimiento y los límites económicos siguen pendientes.
