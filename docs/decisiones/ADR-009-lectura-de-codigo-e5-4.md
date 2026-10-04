# ADR-009 · Preguntas de lectura de código (E5.4)

Fecha: 2026-10-01 · Estado: **aceptado** para el prototipo local (comprobación manual del usuario del 2026-10-03). La generación automática de pasos con código queda pendiente de una evaluación real exitosa: la única generación real devolvió “insuficiente” y la confirmación manual no sustituye esa evidencia.

## Contexto

RF-06 incluye lectura de código y completar fragmentos acotados. E5.1 resolvió la opción múltiple ([ADR-007](ADR-007-recorrido-e5-1.md)) y E5.3 la ayuda contextual ([ADR-008](ADR-008-ayuda-contextual-e5-3.md)). El usuario autorizó E5.4 el 2026-10-01: preguntas de opción múltiple sobre un fragmento de código de solo lectura, sin nuevas reglas de calificación.

## Decisión

1. **Dato opcional del paso:** código (hasta 3000 caracteres), lenguaje opcional (identificador en minúsculas) y origen: `fuente` (copia literal) o `ilustrativo` (ejemplo construido). Son tres columnas nulas en `route_steps`; los pasos existentes, borradores y publicados, no se reescriben.
2. **Generación:** la IA puede proponer código solo cuando el objetivo y las fuentes seleccionadas lo justifiquen. No debe forzarlo ni inventar convenciones. Un ejemplo construido se marca `ilustrativo`. Si el modelo declara `fuente` y el código no aparece en un fragmento citado por el paso (comparando con espacios normalizados), se guarda como `ilustrativo`. Un lenguaje no válido se descarta sin invalidar la ruta. Se mantienen los límites de generación.
3. **Edición:** el responsable añade, cambia o quita el código, el lenguaje y el origen de un paso en borrador. El origen que elige el responsable no se verifica automáticamente: es parte de su revisión antes de publicar.
4. **Presentación:** el código se muestra como texto escapado en `<pre><code>`, conservando espacios y saltos de línea. No se ejecuta, no se resalta y no se interpreta como HTML. La etiqueta indica “Código copiado de la fuente” o “Ejemplo ilustrativo: no es código real de la empresa”.
5. **Recorrido:** se reutilizan intentos, corrección, progreso y citas. El código de un paso bloqueado no se entrega al navegador.
6. **Ayuda contextual:** el código entra en el contexto del paso con su origen. En el modo previo a resolver sigue sin enviarse la clave (RN-34).

## Alternativas consideradas

- **Tipo de paso separado:** descartado; duplicaría la calificación sin aportar nada a la opción múltiple.
- **Rechazar la ruta si el código declarado `fuente` no es literal:** descartado; se conserva el ejemplo y se etiqueta con honestidad.
- **Resaltado de sintaxis con una biblioteca:** descartado por ahora; añadiría una dependencia y otra superficie de HTML.

## Consecuencias

- RF-06 queda cubierto para lectura de código; completar fragmentos sigue pendiente (PEN-03).
- Una ruta publicada es inmutable también en su código.
- La evaluación real de E5.4 devolvió “insuficiente” y no llegó a mostrar código generado (documento 06).

## Corrección de la ayuda con código (2026-10-03)

Durante su prueba manual de E5.4, el usuario informó el 2026-10-03 que, al preguntar “qué hace el código” en un paso resuelto con un ejemplo ilustrativo añadido a mano, la ayuda mostraba “no se pudo verificar” y los fragmentos recuperados trataban de otros temas.

**Causa:** el código sí llegaba al modelo, pero el prompt solo admitía como evidencia citas [n] a fragmentos y `parseModelAnswer` rechaza toda respuesta sin al menos una cita válida. Como ningún fragmento trataba ese código, la explicación no tenía nada que citar y se descartaba.

**Ajuste:** si el paso tiene código, el modelo puede citarlo como `[código]`, que la interfaz muestra como “Código del paso”. Ese marcador solo respalda lo que hace el código visible; las convenciones o prácticas de la empresa siguen exigiendo citas [n] de fragmentos. El validador acepta el marcador solo cuando la ayuda lo habilita para un paso con código, y las citas [n] se validan igual que antes. Con código, la ayuda puede responder aunque no haya fragmentos; sin código, sigue respondiendo “insuficiente” sin llamar al modelo. No cambian los permisos ni las reglas antes y después de resolver.
