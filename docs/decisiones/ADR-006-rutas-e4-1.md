# ADR-006 · Borradores de onboarding generados con IA (E4.1)

Fecha: 2026-10-01 · Estado: **aceptado** para el prototipo local: implementación, evaluación inicial con modelo real y comprobación manual del usuario.

## Contexto

E4 cubre RF-04/RF-05 y CA-04. El usuario aprobó un primer recorrido:
- **Entrada:** objetivo escrito por el responsable y de 1 a 5 fuentes vigentes.
- **Borrador:** de 3 a 7 pasos, cada uno con una lección breve citada y una pregunta de opción múltiple con una única respuesta correcta y explicación.
- **Edición:** borradores visibles y editables solo por responsables.
- **Publicación:** explícita, y la versión publicada queda estable y legible por ambos roles.

Respuestas, calificación y progreso quedan para E5.

## Decisión

- **Generación:**
  - en el worker, con una cola `generar-ruta` sin reintentos automáticos;
  - se reclama con un token, de modo que un trabajo reentregado no repite la llamada;
  - una llamada al modelo configurado (E3) con hasta 12 fragmentos de 1500 caracteres, 16000 caracteres en total y 3000 tokens de salida;
  - solo se usan fragmentos de las fuentes seleccionadas; sin fragmentos no hay llamada.
- **Validación:**
  - estructura, de 3 a 7 pasos, de 3 a 4 opciones distintas y un único índice correcto;
  - citas, tanto en la lista como en las marcas [n], que deben apuntar a fragmentos enviados;
  - las citas se reconstruyen desde los fragmentos;
  - la falta de evidencia se registra como `insuficiente` sin pasos.
- **Edición:**
  - editar textos y respuestas, reordenar y eliminar pasos;
  - control de concurrencia con `edit_version`;
  - regenerar reemplaza el borrador.
- **Publicación:**
  - revalida todos los pasos;
  - exige al menos un paso y que todas sus citas sigan vigentes;
  - después ya no se puede editar ni regenerar; no hay historial de versiones de rutas.
- **Vigencia de las citas (PEN-04 para rutas):**
  - la ruta guarda su propio texto y una instantánea de cada cita (título, versión y ubicación);
  - si la versión citada deja de ser la vigente, o la fuente se elimina, la cita se señala y la ruta queda marcada para revisión;
  - ese estado se calcula al leer, así que el módulo de fuentes no escribe en las rutas;
  - eliminar una fuente no elimina el contenido derivado ya escrito en una ruta.
- **Consumo:**
  - como máximo 5 intentos de generación por espacio y día (UTC);
  - cuentan las llamadas que llegaron al proveedor, incluidas regeneraciones y fallos, más las generaciones encoladas al solicitar;
  - el intento se registra bajo bloqueo justo antes de la llamada;
  - **no es un tope monetario garantizado**.
- **Clave de respuesta:** los integrantes no la reciben (respuesta correcta y explicación) mientras E5 no defina cómo responder.

## Alternativas consideradas

- **Escribir el estado de revisión desde el módulo de fuentes:** descartada, porque rompe la propiedad de los datos por módulo y puede desincronizarse.
- **Permitir publicar con citas obsoletas marcadas:** descartada; el usuario pidió no presentar referencias antiguas como vigentes.
- **Reintentos automáticos de pago:** descartados por consumo.

## Consecuencias

- El responsable debe revisar cada borrador: el modelo puede añadir matices que no están en las fuentes (observado en la evaluación).
- Una ruta publicada cuyas fuentes cambian sigue legible con sus citas señaladas; actualizarla requerirá una versión nueva en una entrega posterior.
- El contenido derivado sobrevive a la purga de su fuente; su retención para datos reales sigue en PEN-06.
