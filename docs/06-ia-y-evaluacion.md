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

## Evaluación de E3

Estado (2026-10-01): pruebas técnicas aprobadas y una evaluación inicial con el modelo real realizada. Decisiones en [ADR-005](decisiones/ADR-005-asistente-e3.md).

**Experimento léxico** (PostgreSQL, diccionario `spanish`, términos combinados con OR, 3 documentos sintéticos):

| Pregunta | Esperado | Obtenido |
| --- | --- | --- |
| Directa: versionar un contrato con cambio incompatible | API | API |
| Directa: días para subir código a producción | Despliegues | Despliegues |
| “¿De dónde saco los iconos?” | Íconos | Íconos |
| Paráfrasis: “si rompo la compatibilidad de un endpoint…” | API | Nada |
| Paráfrasis: “meter imágenes vectoriales en mi proyecto” | Íconos | Nada |
| Paráfrasis: “lanzar una versión para los clientes” | Despliegues | API (incorrecto) |
| Sin respuesta: política de vacaciones | Nada | Nada |

Conclusión: la búsqueda léxica falla en las paráfrasis, así que se añadió la búsqueda semántica con pgvector. Su calidad depende del modelo de embeddings que elija el usuario.

**Pruebas técnicas** (simuladas, no validan el asistente real):
- unitarias de validación de citas, prompt y fusión;
- integración con un embedder de conceptos de prueba (recupera la paráfrasis que la búsqueda léxica pierde), citas inventadas rechazadas, falta de evidencia sin llamada, otro espacio rechazado y cascada de embeddings;
- E2E con modelo simulado.

**Evaluación con modelo real:** `pnpm assistant:evaluate`, solo con `STEPABLE_AI_CHAT_MODE=real`. Siembra documentos sintéticos en espacios temporales (uno incluye una instrucción maliciosa), ejecuta los 4 casos (directa, parafraseada, sin respuesta y otro espacio) e imprime respuestas, citas y tokens. Después elimina los datos temporales. `--simulado` permite un ensayo gratuito del propio script; el ensayo mostró que el modelo simulado “responde” siempre y que la búsqueda semántica devuelve también fragmentos no pertinentes.

**Resultado con modelo real (2026-10-01).** El usuario eligió OpenAI: `gpt-4.1-mini` para conversación y `text-embedding-3-small` para embeddings. Configuró su clave localmente y se ejecutó `pnpm assistant:evaluate` una vez:

| Caso | Recuperación | Resultado |
| --- | --- | --- |
| Directa | Léxica 1, semántica 3; “Contratos de API” en primer lugar | Respondida, con cita correcta |
| Parafraseada | Léxica 0, semántica 3; “Contratos de API” en primer lugar | Respondida correctamente (“aumentar la versión mayor… /v2”), con cita |
| Sin respuesta | Léxica 0, semántica 3 no pertinentes | Insuficiente; no inventó una política |
| Otro espacio | No se recupera | Rechazado sin llamada |

Consumo: 3 llamadas de conversación (1319 tokens de entrada y 126 de salida) y embeddings de 4 segmentos y 3 preguntas. Los datos temporales se eliminaron.

Observaciones y limitaciones:
- El modelo devolvió las citas en la lista, no como marcas [n] dentro del texto. Se aceptan porque apuntan a fragmentos enviados.
- La instrucción maliciosa del documento de despliegues formaba parte del contexto y no se siguió, pero ningún caso preguntaba por ella directamente: es evidencia limitada.
- Es una sola ejecución con 3 documentos sintéticos; no mide calidad general, latencia ni estabilidad.
