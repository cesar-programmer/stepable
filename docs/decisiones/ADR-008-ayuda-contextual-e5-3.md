# ADR-008 · Ayuda contextual del asistente en lecciones (E5.3)

Fecha: 2026-10-01 · Estado: **aceptado** para el prototipo local (comprobación manual del usuario del 2026-10-01).

## Contexto

RF-08 incluye la ayuda contextual dentro de las lecciones. E3 ya ofrece el asistente general con evidencia ([ADR-005](ADR-005-asistente-e3.md)) y E5.1 entrega la clave de respuesta solo al resolver un paso ([ADR-007](ADR-007-recorrido-e5-1.md)). El usuario autorizó E5.3 el 2026-10-01: un botón “Pedir ayuda” por paso, que da pistas antes de resolver y explicación después, sin infraestructura nueva.

## Decisión

1. **Reutilizar E3:** misma integración de IA, búsqueda híbrida, límites por consulta (una llamada, hasta 6 fragmentos), validación de citas (`parseModelAnswer`) y ausencia de historial.
2. **Contexto en el servidor:** el navegador solo envía identificadores y una duda opcional. El servidor revalida `consultar_rutas` y `consultar_fuentes`, lee el paso de la ruta publicada y deriva su estado con las reglas de E5.1. Rechaza pasos bloqueados, rutas no empezadas y rutas no publicadas, sin llamar al modelo.
3. **Dos modos:**
   - **Ayuda para comprender** (paso no resuelto; internamente, modo `pistas`): el prompt incluye título, lección, pregunta y opciones, nunca la respuesta correcta ni la explicación. Indica que no se elija opción ni se entregue la solución.
   - **Explicación** (paso resuelto): añade la respuesta correcta, la explicación y las respuestas de la persona.
4. **Búsqueda prioritaria:** primero en las fuentes citadas por el paso que siguen activas (versión vigente). El resto del espacio solo completa los fragmentos libres; esas citas se marcan como “otra fuente del espacio”.
5. **Fuentes cambiadas:** si alguna cita del paso no está vigente, se muestra un aviso y el prompt lo indica. La versión vigente no se presenta como respaldo de la lección. Sin fragmentos, se responde “información insuficiente” sin llamar al modelo.
6. **Sin efecto en el progreso:** la ayuda no escribe intentos ni progreso.

## Límite reconocido

Las instrucciones buscan orientar sin entregar la solución, pero no lo impiden. Además, las fuentes y el asistente general siguen accesibles. En la evaluación real, el modo pistas dedujo y expuso la respuesta a partir del fragmento (documento 06). Las instrucciones de orientación se reforzaron después; **ese prompt reforzado no se reevaluó con el modelo real**. El usuario aceptó esta limitación el 2026-10-01 y decidió no añadir más barreras ni evaluaciones de pago por ahora. La interfaz titula esta ayuda “Ayuda para comprender”, no “Pistas”, para no sugerir que la solución queda oculta.

## Alternativas consideradas

- **Enviar la clave también en modo pistas y pedir que no la revele:** descartada; el modelo podría filtrarla.
- **Filtrar después las respuestas que mencionen la opción correcta:** descartada por ahora; sería frágil ante paráfrasis y añadiría complejidad.
- **Buscar solo en las fuentes del paso:** descartada; las fuentes eliminadas dejarían el paso sin ayuda, aunque el espacio tenga información relacionada.

## Consecuencias

- RF-08 queda cubierto para opción múltiple en el prototipo local.
- Las consultas cuentan como las del asistente: no hay límite acumulado de gasto (PEN-08).
- No se guardan preguntas ni respuestas de ayuda; los logs solo registran identificadores, modo, resultado, número de fragmentos y uso de tokens.
