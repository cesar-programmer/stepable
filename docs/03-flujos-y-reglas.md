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
