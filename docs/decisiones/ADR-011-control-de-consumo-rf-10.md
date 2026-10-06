# ADR-011 · Control de consumo estimado de IA (RF-10)

Fecha: 2026-10-06 · Estado: **aceptado** para el prototipo local (comprobación manual del usuario del 2026-10-06).

## Contexto

RF-10 exige controlar el consumo de IA. Hasta ahora solo había límites por consulta y 5 generaciones por espacio y día, que no acotan el gasto acumulado (PEN-08). El usuario cargó 5 USD de saldo inicial en OpenAI. Ese saldo no es un presupuesto mensual ni una autorización para gastarlo completo. El 2026-10-06 aprobó estos límites, todos configurables:

- 1 USD estimado acumulado para todo el prototipo;
- 0,20 USD estimados por espacio y día;
- 40 consultas por usuario y día, sumando asistente y ayuda en todos sus espacios;
- las 5 generaciones existentes por espacio y día.

Los límites diarios se reinician a las 00:00 UTC; el acumulado no se reinicia ni se amplía solo.

## Decisión

1. **Registro mínimo** (`ai_usage`): una fila por llamada de conversación o de embeddings, con función, espacio, usuario, clave de tarifa, estado, tokens y costo estimado en microdólares. No se guardan preguntas, respuestas, documentos ni claves. El consumo cuenta desde la activación (`ai_budgets.started_at`). No es el gasto histórico total ni el saldo de OpenAI.
2. **Tarifas** (`src/lib/ai-pricing.ts`): verificadas el 2026-10-06 en la página oficial de precios de OpenAI, nivel Standard.
   - `gpt-4.1-mini`: 0,40 USD por millón de tokens de entrada y 1,60 USD por millón de salida;
   - `text-embedding-3-small`: 0,02 USD por millón de tokens.

   Un modelo real sin tarifa no se llama, y el worker y los scripts lo avisan al empezar.
3. **Reserva atómica antes de llamar:** en una transacción con bloqueo por namespace se comprueban juntos el límite global, el diario del espacio y, para asistente y ayuda, las consultas diarias del usuario.
   - La reserva es una cota superior: los bytes UTF-8 del prompt más 64 tokens por mensaje, más el máximo de salida permitido. Con tokenizadores BPE por bytes, cada token ocupa al menos un byte; no es una media de caracteres.
4. **Ajuste:** con el uso informado por el proveedor se registra el costo real estimado.
   - Un rechazo del proveedor (4xx salvo 408) libera la reserva.
   - Los resultados inciertos (tiempo agotado, 5xx, falta de uso informado) conservan la reserva.
   - Cada reserva se liquida una sola vez.
5. **Cobertura:** asistente, ayuda contextual, generación de rutas (en dos fases: la reserva va antes del intento diario y se libera si no queda intento) e indexación (lotes por espacio). Los modelos simulados no se registran. Las pruebas usan su propio namespace, así que nunca afectan al resumen del prototipo.
6. **Al alcanzar un límite:** no se llama al modelo.
   - El mensaje distingue el límite diario del espacio, el diario del usuario y el global. Solo los diarios prometen restablecimiento; en el global hay que pedir al operador que lo amplíe.
   - El asistente y la ayuda conservan los fragmentos encontrados.
   - La generación queda como fallida recuperable, sin gastar intento.
   - La indexación deja los segmentos pendientes y se detiene hasta las 00:00 UTC (límite diario) o hasta comprobarlo cada hora (límite global o falta de tarifa), sin llamar al proveedor.
7. **Resumen para responsables** (`consultar_consumo_ia`) en la página del espacio: consumo estimado de hoy en el espacio frente a su límite y si el presupuesto global está agotado, sin cifras de otros espacios.

## Alternativas consideradas

- **Facturación o lectura del saldo real de OpenAI:** fuera de alcance; el panel del proveedor sigue siendo la referencia del gasto real.
- **Estimar tokens con una media de caracteres:** descartado porque puede quedarse corta. Se usa una cota por bytes, que sobrerreserva texto en español.
- **Comprobar sin reservar:** descartado; dos solicitudes simultáneas podrían superar el límite.

## Consecuencias

- La reserva sobreestima la entrada (unas 3 o 4 veces en texto en español), así que cerca del límite puede bloquear antes de lo estrictamente necesario.
- Los costos son estimaciones con tarifas fijas; un cambio de precio requiere actualizar la tabla.
- El consumo real anterior a la activación no está registrado.
