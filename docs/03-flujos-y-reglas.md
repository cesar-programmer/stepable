# Flujos y reglas

Estado: reglas base del alcance; ciclo local de membresía implementado hasta E1.6, flujos posteriores propuestos.
Actualizado: 2026-10-01.

## Flujos principales

### F-01 Preparar conocimiento

Durante la V0, el operador aprovisiona el espacio y designa su primer responsable según RN-10. El responsable agrega una fuente y ve su procesamiento. Si falla, recibe un error comprensible y puede reintentar. Solo contenido listo se utiliza para responder o generar rutas. Reemplazar una fuente conserva su identidad y registra una versión; política de selección pendiente PEN-04. Ciclo de vida de E2 en RN-19–RN-25.

### F-02 Crear onboarding

Responsable establece objetivo, selecciona fuentes y tipos de actividades. La generación crea un borrador. Revisa explicaciones, citas y criterios de respuesta; edita y publica. Un error de generación debe permitir recuperarse sin publicar contenido incompleto.

### F-03 Aprender

Integrante accede a una ruta publicada, completa pasos, responde actividades y recibe retroalimentación. Puede consultar al asistente con contexto del paso. Al volver, retoma su progreso en la misma versión. Aprobación, reintentos y desbloqueo pendientes PEN-03.

### F-04 Consultar

Integrante pregunta en el contexto de un espacio. El sistema comprueba acceso, recupera evidencia y responde con citas o comunica insuficiencia. Acceder desde una lección añade contexto; no habilita fuentes ajenas al espacio.

## Reglas base

| ID | Regla |
| --- | --- |
| RN-01 | Ningún contenido generado se publica automáticamente |
| RN-02 | La respuesta sobre una regla interna requiere evidencia que respalde la afirmación |
| RN-03 | Toda lectura o escritura debe respetar pertenencia al espacio y rol |
| RN-04 | Chats personales privados; responsables acceden a avance y resultados, no a esos chats |
| RN-05 | Una ruta publicada se modifica creando otra versión; el progreso conserva la versión cursada |
| RN-06 | Cambios de fuente señalan rutas afectadas para revisión; no reescriben lecciones publicadas |
| RN-07 | Aprobación de actividades basada en criterios definidos; opinión libre de IA no implica aprobación |

## Casos por especificar

Fuentes contradictorias, eliminación de fuentes citadas, ruta obsoleta y doble envío de respuestas siguen abiertos. E1.4 centraliza la autorización mínima, E1.5 incorpora invitaciones locales y E1.6 completa cambios de rol, retiro y autosalida con protección transaccional del último responsable. Ver [datos y permisos](05-datos-y-permisos.md) y PEN-03, PEN-04 y PEN-06.

## Ciclo de vida de fuentes (E2)

Estado: RN-19–RN-25 se aplican desde E2.1–E2.4 (2026-10-01) a fuentes Markdown y PDF. Contradicciones, rutas obsoletas y referencias históricas siguen abiertas para E3/E4 ([ADR-004](decisiones/ADR-004-fuentes-locales-e2.md)).

Estados de versión: `en_cola`, `procesando`, `lista`, `fallida`, `reemplazada`, `descartada`. Estados de fuente: `activa`, `eliminada`.

| ID | Regla | Estado |
| --- | --- | --- |
| RN-19 | Una fuente está **vigente** cuando está `activa` y tiene una versión vigente en estado `lista`. Cada fuente tiene como máximo una versión vigente. Solo el contenido de esa versión será elegible en entregas posteriores. | Aplicada en E2.1–E2.2 |
| RN-20 | La primera carga crea la fuente y su versión 1 `en_cola`. Si el procesamiento falla, la fuente existe sin versión vigente y muestra el motivo al responsable. | Aplicada en E2.1–E2.2; reintento manual y eliminación en E2.3/E2.4 |
| RN-21 | Solo un responsable activo puede reemplazar. El reemplazo conserva la identidad de la fuente y crea una versión candidata; la vigente lo sigue siendo hasta que la candidata quede `lista`, y entonces el cambio es atómico y la anterior pasa a `reemplazada`. Solo puede haber una candidata en curso por fuente. Un archivo idéntico (SHA-256) a la vigente se rechaza como “sin cambios”. | Aplicada en E2.3 |
| RN-22 | Si la candidata falla, la versión vigente no cambia ni pierde contenido y el responsable ve el motivo. Puede reintentar o cargar un archivo corregido, que deja la versión fallida como `descartada`. Las versiones anteriores se conservan sin historial visible hasta que E2.4 defina la retención. | Aplicada en E2.3 |
| RN-23 | Reintentar procesa la misma versión: no crea otra versión ni duplica el texto. Hay hasta 3 reintentos manuales por versión fallida, solo para responsables activos; una pulsación repetida no encola un segundo trabajo. Los reintentos automáticos siguen en el [documento 04 §19](04-arquitectura.md#19-fuentes-locales-en-e2). | Aplicada en E2.1–E2.3 |
| RN-24 | Solo un responsable activo puede eliminar una fuente, tras una confirmación explícita de que se borrarán todas sus versiones y archivos, sin papelera. La fuente desaparece para ambos roles en la misma transacción. El worker purga originales y texto de todas las versiones, y ningún trabajo pendiente o en curso puede volver a publicarla. Solo quedan metadatos mínimos ([documento 05](05-datos-y-permisos.md#fuentes-e2)). | Aplicada en E2.4 |
| RN-25 | Fuente, versiones, texto, archivos y trabajos pertenecen a un único espacio. Toda lectura y escritura filtra por espacio y pasa por la autorización central. La clave de almacenamiento nunca es autorización. | Aplicada en E2.1–E2.2 |

## Rutas generadas (E4.1)

Estado: aplicadas el 2026-10-01 en el prototipo local ([ADR-006](decisiones/ADR-006-rutas-e4-1.md)). RN-01 y la estabilidad de RN-05 se aplican a la primera versión publicada; la edición posterior con versión nueva queda pendiente.

| ID | Regla | Estado |
| --- | --- | --- |
| RN-26 | Un borrador se genera solo con fragmentos de las fuentes vigentes seleccionadas. Sin evidencia suficiente se registra como insuficiente, sin pasos inventados. | Aplicada en E4.1 |
| RN-27 | Solo un responsable activo edita, regenera y publica. La publicación revalida el borrador y exige que todas sus citas apunten a versiones vigentes; después la ruta no se edita. | Aplicada en E4.1 |
| RN-28 | Si una fuente citada se reemplaza o elimina, la ruta conserva su contenido, la cita se señala y la ruta queda marcada para revisión. Eliminar una fuente no elimina el contenido derivado ya escrito en rutas. | Aplicada en E4.1 |

## Recorrido y progreso de rutas (E5.1–E5.2)

Estado: aplicadas el 2026-10-01 en el prototipo local ([ADR-007](decisiones/ADR-007-recorrido-e5-1.md)); resuelven PEN-03 para preguntas de opción múltiple.

| ID | Regla | Estado |
| --- | --- | --- |
| RN-29 | Cada pregunta admite hasta 3 intentos. La respuesta correcta y la explicación solo se entregan al acertar o al agotar los intentos. | Aplicada en E5.1 |
| RN-30 | Un paso está **resuelto** si se acertó o se agotaron sus intentos; está **acertado** solo si se acertó dentro de los intentos. El siguiente paso se desbloquea al resolver el actual. | Aplicada en E5.1 |
| RN-31 | La ruta está **completada** cuando todos sus pasos están resueltos, sin nota mínima. El resultado cuenta los pasos acertados, no los envíos, y completar no implica dominio del contenido. | Aplicada en E5.1 |
| RN-32 | El progreso es privado de cada usuario, pertenece a la versión publicada recorrida y se califica en el servidor. Un envío repetido no cuenta como un intento nuevo. Una ruta marcada “Revisar” puede continuarse con el aviso visible. | Aplicada en E5.1 |
| RN-33 | Solo los responsables activos ven el progreso del equipo de una ruta publicada: totales por miembro activo (estado, pasos resueltos, pasos acertados, fechas), sin respuestas ni detalle por paso y sin mezclar versiones. Los retirados se ocultan; “no empezada” no implica obligación. | Aplicada en E5.2 |

### Ayuda contextual en lecciones (E5.3)

Estado: aplicada el 2026-10-01 en el prototipo local ([ADR-008](decisiones/ADR-008-ayuda-contextual-e5-3.md)). El usuario aceptó como limitación que la ayuda previa pueda revelar o permitir deducir la respuesta.

| ID | Regla | Estado |
| --- | --- | --- |
| RN-34 | Cada paso visible ofrece “Pedir ayuda”. Antes de resolverlo, el asistente ofrece “Ayuda para comprender”: explica conceptos y orienta, con la instrucción de no elegir opción ni entregar la solución; la clave y la explicación nunca se envían al modelo en ese momento. Después de resolverlo, puede explicar la respuesta. La ayuda no consume intentos ni cambia el progreso. Busca primero en las fuentes citadas por el paso y conserva las citas verificables; si alguna fuente cambió o se eliminó, avisa y no presenta la versión vigente como respaldo de la lección. No garantiza que la respuesta no pueda revelarse o deducirse. | Aplicada en E5.3 |

### Lectura de código (E5.4)

Estado: aplicada en el prototipo local (comprobación manual del usuario del 2026-10-03; generación automática de código sin evaluación real exitosa) ([ADR-009](decisiones/ADR-009-lectura-de-codigo-e5-4.md)).

| ID | Regla | Estado |
| --- | --- | --- |
| RN-35 | Un paso puede incluir, de forma opcional, un fragmento de código de solo lectura (lenguaje opcional) sobre el que trata su pregunta de opción múltiple. Se califica igual que cualquier paso. La IA solo lo propone cuando las fuentes seleccionadas lo respaldan, sin inventar convenciones ni forzarlo. Un ejemplo construido se etiqueta como ilustrativo y nunca como código real de la empresa. El responsable puede añadirlo, editarlo o quitarlo antes de publicar. El código se muestra como texto y nunca se ejecuta ni se interpreta como HTML. La ayuda puede explicar lo que hace el código visible citándolo como “Código del paso”; las afirmaciones sobre prácticas de la empresa siguen exigiendo fuentes documentales. | Aplicada en E5.4 |

### Completar fragmentos de código (E5.5)

Estado: aplicada en el prototipo local (comprobación manual del usuario del 2026-10-06) ([ADR-010](decisiones/ADR-010-completar-codigo-e5-5.md)).

| ID | Regla | Estado |
| --- | --- | --- |
| RN-36 | Un paso puede ser de tipo “completar”: un fragmento de código con un único hueco visible y una respuesta escrita breve. Se corrige en el servidor, sin ejecutar código ni usar IA: es correcta si coincide con la respuesta principal o con una variante aceptada, ignorando solo los espacios del inicio y del final; no se asume equivalencia entre programas, y el ejercicio lo explica. El responsable configura y revisa las respuestas aceptadas antes de publicar. Se aplican RN-29 a RN-33 sin cambios, y la solución no llega al navegador ni a la ayuda antes de resolver. | Aplicada en E5.5 |
| RN-37 | Al generar un borrador, el responsable elige los tipos de actividad solicitados: opción múltiple (predeterminado), lectura de código (opción múltiple sobre un fragmento visible) y completar código. Puede elegir varios. El borrador debe incluir al menos un paso de cada tipo solicitado, respaldado por las fuentes. Si no hay evidencia, queda como insuficiente, sin sustituir el tipo ni inventar convenciones. El servidor rechaza un borrador que no cubre los tipos (“tipos_no_cubiertos”) sin reintentar, e indica los tipos solicitados, los que faltaron y si las fuentes seleccionadas contienen bloques de código. Los tipos no solicitados no se piden al modelo. | Aplicada en E5.5 |
| RN-38 | Si la generación de un borrador termina sin evidencia suficiente, sin cubrir los tipos solicitados o con un fallo técnico, la misma ruta explica el caso sin códigos internos y permite ajustar el objetivo, las fuentes y las actividades, incluido el ajuste explícito “Usar solo opción múltiple”. Ajustar no llama al modelo ni consume intentos. Solo “Generar con estos cambios” regenera la misma ruta, consume un intento y hace una llamada, sin reintentos automáticos ni sustituciones de actividades. Si se agotó la cuota diaria, se indica cuándo se restablece (00:00 UTC). | Aplicada en E5.5 |

## Control de consumo de IA (RF-10)

Estado: aplicada en el prototipo local (comprobación manual del usuario del 2026-10-06) ([ADR-011](decisiones/ADR-011-control-de-consumo-rf-10.md)).

| ID | Regla | Estado |
| --- | --- | --- |
| RN-39 | Antes de cada llamada real de IA (asistente, ayuda, generación e indexación) se reserva un costo estimado conservador. Se comprueban a la vez el límite acumulado del prototipo (1 USD), el diario del espacio (0,20 USD) y, para asistente y ayuda, las consultas diarias del usuario (40 entre todos sus espacios). Los límites son configurables y las 5 generaciones diarias por espacio se mantienen. Si un límite lo impide, no se llama al modelo y se explica cuál fue; solo los diarios se restablecen solos (00:00 UTC), y el acumulado requiere que el operador lo amplíe. El consumo se registra desde la activación, es una estimación y no es la factura ni el saldo del proveedor. Las funciones sin IA siguen disponibles. | Aplicada |
