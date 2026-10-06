# ADR-010 · Completar fragmentos acotados de código (E5.5)

Fecha: 2026-10-06 · Estado: **aceptado** para el prototipo local (comprobación manual del usuario del 2026-10-06), incluidas la selección de actividades (RN-37) y la recuperación de generaciones (RN-38). Limitaciones que se conservan: la corrección es solo una comparación textual (no reconoce soluciones equivalentes); la evaluación real fue pequeña (2 generaciones, una sin código y otra con la solución visible en la lección); y la validación de solución visible no se reevaluó con el modelo real.

## Contexto

RF-06 incluye completar fragmentos acotados de código. E5.4 añadió código de solo lectura a los pasos ([ADR-009](ADR-009-lectura-de-codigo-e5-4.md)). El usuario autorizó E5.5 el 2026-10-03: un nuevo tipo de actividad con un único hueco, respuesta escrita y corrección exacta en el servidor, reutilizando las reglas de E5.1 ([ADR-007](ADR-007-recorrido-e5-1.md)).

## Decisión

1. **Tipo de actividad del paso:** `opcion_multiple` (predeterminado; los pasos existentes no cambian) o `completar`. Un paso `completar` tiene código con exactamente un `[[hueco]]`, no tiene opciones y guarda de 1 a 5 respuestas aceptadas de una línea y hasta 200 caracteres. La primera es la principal.
2. **Corrección:** en el servidor, sin ejecutar código ni llamar a la IA. La respuesta es correcta si coincide con una aceptada después de recortar solo los espacios del inicio y del final. Cuentan mayúsculas, espacios internos y signos; no se asume equivalencia entre programas. El ejercicio lo explica a quien responde.
3. **Reglas reutilizadas:** 3 intentos, resuelto al acertar o agotar intentos, solución (principal y variantes) y explicación solo al resolver, progreso por versión, identificador de envío contra el doble envío y los mismos totales del equipo. Un intento guarda la opción elegida o el texto escrito, nunca ambos.
4. **Confidencialidad de la solución:** las respuestas aceptadas no llegan al navegador del integrante ni a la ayuda antes de resolver; la vista de la ruta las oculta a los integrantes también después.
5. **Ayuda:** recibe el código con el hueco y la indicación de no escribir el texto del hueco. Después de resolver, recibe la respuesta principal, las variantes y las respuestas de la persona. Se mantiene la limitación aceptada de que la ayuda puede permitir deducir la respuesta ([ADR-008](ADR-008-ayuda-contextual-e5-3.md)).
6. **Generación:** la IA puede proponer este tipo solo si las fuentes contienen código que lo respalde. Si quedan opciones o índice correcto sobrantes, se ignoran. La copia literal se verifica sustituyendo el hueco por la respuesta principal. Sin un hueco único o sin respuestas aceptadas, el borrador no es válido. Los límites de generación no cambian.
7. **Edición:** el responsable elige el tipo, el código con el hueco y las respuestas aceptadas (una por línea) antes de publicar.

## Alternativas consideradas

- **Ejecutar el código o comparar por equivalencia semántica:** fuera de la V0 y descartado por el usuario.
- **Expresiones regulares configurables:** descartadas; añaden complejidad y errores difíciles de revisar.
- **Normalizar mayúsculas o espacios internos:** descartado; en código pueden cambiar el significado.

## Consecuencias

- RF-06 queda cubierto en el prototipo local: opción múltiple, lectura de código y completar fragmentos.
- Una solución equivalente pero distinta se califica como incorrecta; el responsable puede añadir variantes antes de publicar.
- La generación automática de estos ejercicios no tiene evaluación real exitosa: en la única ejecución real (2026-10-06) el modelo generó 3 pasos de opción múltiple, sin “completar” ni código (documento 06). Tampoco cubre la lectura de código de E5.4.

## Tipos de actividad solicitados (2026-10-06)

La primera evaluación real mostró que, si los tipos de código son solo opcionales, el modelo no los usa. A petición del usuario, al generar se eligen los tipos **solicitados** (RN-37): opción múltiple (predeterminado), lectura de código y completar código. El prompt solo describe esos tipos y pide al menos un paso de cada uno, o “insuficiente” si las fuentes no los respaldan. El servidor clasifica los pasos y rechaza con `tipos_no_cubiertos`, sin reintentar, un borrador que no cubre todos los tipos. Este ajuste sustituye la regla de E5.4 de proponer código de forma opcional: ahora el código solo se pide cuando se solicita ([ADR-009](ADR-009-lectura-de-codigo-e5-4.md)).

La segunda evaluación real generó ambos tipos, pero la lección del paso de completar contenía la solución. Por eso se añadieron una instrucción en el prompt y una validación en el servidor: un borrador cuya lección o pregunta contiene el código con el hueco completado no es válido. Este ajuste no se evaluó con el modelo real.
