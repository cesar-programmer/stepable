# ADR-005 · Asistente con evidencia para E3

Fecha: 2026-10-01 · Estado: **aceptado** para el prototipo local: implementación, evaluación inicial con el modelo elegido por el usuario (OpenAI `gpt-4.1-mini` y `text-embedding-3-small`) y comprobación manual. El historial de conversaciones queda pospuesto.

## Contexto

El usuario priorizó validar el asistente con IA real (RF-08, CA-03). La búsqueda textual es una base, no una entrega aislada. El usuario elegirá el proveedor y el modelo (DeepSeek u OpenAI) y configurará su clave localmente. Los embeddings son una decisión aparte. Solo se pueden enviar preguntas y fragmentos de documentos sintéticos al proveedor aprobado. No hay historial de conversaciones.

## Decisión

- **Recuperación híbrida en PostgreSQL:**
  - búsqueda léxica en español (`tsvector` generado e índice GIN);
  - búsqueda semántica con pgvector (`source_segment_embeddings`, un vector por segmento y modelo);
  - fusión por rango recíproco, sin reordenamiento con modelos ni base vectorial externa.

  Solo son elegibles los segmentos de la versión vigente y lista de fuentes activas del espacio autorizado.
- **Un único cliente HTTP compatible con la API de OpenAI**, que ambos proveedores exponen, sin SDK. Proveedor, modelo y URL base se configuran por variables de servidor.
  - La conversación y los embeddings se configuran por separado (`STEPABLE_AI_CHAT_*` y `STEPABLE_AI_EMBEDDINGS_*`).
  - Ambos están desactivados por defecto; el modo `real` debe elegirse expresamente.
  - Las pruebas fuerzan el modo `simulado`.
- **Una llamada por consulta:**
  - contexto de hasta 6 fragmentos, de 1500 caracteres cada uno y 9000 en total;
  - salida de 700 tokens como máximo;
  - 30 s de tiempo límite, sin reintentos.

  Sin fragmentos no hay llamada.
- **Respuesta en JSON validado:**
  - toda cita debe apuntar a un fragmento enviado;
  - una respuesta sin citas o con una cita inventada no se muestra;
  - las citas se construyen desde los fragmentos recuperados (fuente, versión, página o sección), no desde el texto del modelo.
- Los documentos se tratan como datos: van delimitados, sus etiquetas se neutralizan y el prompt prohíbe seguir instrucciones contenidas en ellos.

## Alternativas consideradas

- **Solo búsqueda léxica:** descartada. En el experimento con documentos sintéticos falló en las 3 paráfrasis ([documento 06](../06-ia-y-evaluacion.md#evaluación-de-e3)).
- **SDK por proveedor o capa multi-proveedor:** innecesarios para dos proveedores con la misma API.
- **Base vectorial externa o reranking:** fuera de alcance; el volumen del prototipo no lo justifica.

## Consecuencias

- La calidad real solo se puede afirmar después de la evaluación con el modelo elegido. Las pruebas simuladas validan la mecánica, no el asistente.
- La búsqueda semántica siempre devuelve los fragmentos más cercanos, sean o no pertinentes. La decisión de declarar falta de evidencia recae en el modelo, porque no hay umbral de similitud calibrado.
- Cambiar de modelo de embeddings requiere reindexar; los vectores de cada modelo conviven y se filtran por nombre y dimensión.
- Las citas no se persisten. Al no haber historial, el comportamiento acordado para fuentes reemplazadas o eliminadas se conserva: solo se cita la versión vigente.
