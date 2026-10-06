# Estado actual y reanudación

Actualizado: 2026-10-06 · Fase: control de consumo de IA (RF-10) cerrado para el prototipo local · Versión documental: 4.3.

## Hechos acordados

- Producto propio para validar y portafolio, desarrollado individualmente con Codex.
- Onboarding interactivo y consultas permanentes como usos centrales; V0 enfocada en equipos de software.
- Arquitectura modular, web/API juntas, worker desde E2 y stack local aceptados.
- Identidad E1.2 aceptada solo en local: correo/contraseña, sesión, recuperación por Mailpit, validación en servidor y ausencia de registro público.
- E1.3 acepta usuarios en varios espacios, membresía única por usuario/espacio, roles `responsable`/`integrante`, responsables múltiples y bootstrap privado por operador sobre una identidad existente.
- E1.4 acepta la matriz mínima por espacio, revalidación en PostgreSQL por solicitud, membresías activas/revocadas y revocación sin cerrar sesión global ni afectar otros espacios.
- E1.5 acepta invitaciones locales de siete días, integrante predeterminado, responsable explícito, cuenta Auth separada de aceptación Stepable, reactivación con el rol invitado y preservación del rol de membresías activas.
- E1.6 acepta administración local: responsables activos gestionan miembros bajo la protección del último responsable; ambos roles activos pueden abandonar su propia membresía; revocadas solo se reactivan por una nueva invitación.
- E2.1 autorizada el 2026-10-01: Markdown, Storage privado, `pg-boss`, permisos por espacio, estados visibles y documentos sintéticos. Se aceptan documentos cortos; solo se rechazan los vacíos. Conservación y eliminación se deciden en E2.3/E2.4 ([ADR-004](decisiones/ADR-004-fuentes-locales-e2.md)).

- E2.2 autorizada el 2026-10-01: PDF con texto ≤ 8 MiB y ≤ 200 páginas, sin cifrar y sin OCR, reutilizando la infraestructura de E2.1.

- E2.3 autorizada el 2026-10-01: reemplazo con candidata, cambio atómico, hasta 3 reintentos manuales y conservación de versiones anteriores sin historial visible hasta E2.4.

- E2.4 autorizada el 2026-10-01:
  - conservación de versiones mientras exista la fuente;
  - eliminación solo por responsables activos, con confirmación explícita y sin papelera;
  - retiro inmediato y purga por el worker;
  - metadatos mínimos y auditoría con el patrón existente.

- E2 cerrada el 2026-10-01 para el prototipo local con documentos sintéticos. Archivos huérfanos aceptados como limitación hasta usar documentación real o desplegar (PEN-12).

- E3 repriorizada el 2026-10-01: validar el asistente con IA real. El usuario elegirá proveedor (DeepSeek u OpenAI) y modelo y configurará su clave localmente. Los embeddings son una decisión aparte. Solo se envían preguntas y fragmentos sintéticos; no hay historial.

- E4.1 aprobada el 2026-10-01 con las decisiones de ADR-006: objetivo y hasta 5 fuentes, de 3 a 7 pasos con lección y opción múltiple, borradores solo para responsables, publicación explícita y estable, 5 intentos por espacio y día, y avisos de citas obsoletas.

- E5.1 aprobada el 2026-10-01 con cinco reglas: 3 intentos, respuesta correcta y explicación al resolver, avance secuencial, ruta completada sin nota mínima y progreso ligado a la versión publicada (ADR-007).

- E5.3 autorizada el 2026-10-01: ayuda contextual por paso, con pistas sin clave antes de resolver y explicación después. No consume intentos, reutiliza E3 y autoriza hasta 2 preguntas reales de evaluación (RN-34, ADR-008). Aceptada el 2026-10-01 con la limitación de que la ayuda previa puede revelar o permitir deducir la respuesta.

- E5.4 autorizada el 2026-10-01: preguntas de opción múltiple sobre un fragmento de código opcional de solo lectura, propuesto por la IA solo con respaldo de las fuentes y editable por el responsable. Autoriza 1 generación real de evaluación; quedan excluidos completar fragmentos, ejecución y nuevas reglas de calificación (RN-35, ADR-009 propuesto).

- E5.5 autorizada el 2026-10-03: actividad “completar” con un único hueco, respuesta escrita y corrección exacta en el servidor (solo se ignoran los espacios de los extremos), respuestas aceptadas configuradas por el responsable y reutilización de las reglas de E5.1 a E5.3. Las llamadas reales requieren presentar antes el caso (RN-36, ADR-010 propuesto).

- RF-10 autorizado el 2026-10-06: 1 USD estimado acumulado para el prototipo, 0,20 USD por espacio y día, 40 consultas por usuario y día (asistente y ayuda) y las 5 generaciones diarias. Los diarios se reinician a las 00:00 UTC y el acumulado no se amplía solo. El acumulado empieza en 0 al activar la entrega. Los 5 USD cargados en OpenAI son saldo inicial, no presupuesto (ADR-011 propuesto, RN-39).

## Actualización más reciente

2026-10-06: el usuario confirmó la comprobación manual del control de consumo y aceptó RF-10 para el prototipo local. Se cierra en un commit local, sin push, reutilizando la verificación técnica (después solo cambió documentación); sin llamadas de pago.

## Realizado

- E1.1 cerrada y comprobada por el usuario: base Next.js, Supabase CLI y puertos limitados a `127.0.0.1`.
- Añadidos `@supabase/ssr` 0.12.7 y `@supabase/supabase-js` 2.116.0 con versiones bloqueadas.
- Bloqueado el registro público mediante `auth.enable_signup = false`; proveedor de correo habilitado para login y recuperación.
- Implementados adaptador de identidad, cookies SSR, renovación en `proxy.ts`, acciones de sesión y validación servidor con `getUser()`.
- Implementados `/login`, `/recover`, `/auth/callback`, `/auth/update-password` y `/protected`.
- Añadida plantilla local de recuperación capturada por Mailpit y rechazo uniforme de enlaces inválidos o consumidos.
- Añadido `pnpm auth:create-local-user`: entrada interactiva, contraseña no visible y creación confirmada solo en Auth local.
- Añadidos arnés de integración real y E2E con identidades aleatorias eliminadas al terminar; no se reinicia la base.
- Añadidos esquema SQL/Drizzle de acceso, adaptador PostgreSQL y casos de uso separados de la interfaz.
- Añadido `pnpm access:bootstrap-space`: exige identidad existente, valida `slug`/nombre/correo, serializa concurrencia y no crea contraseñas o invitaciones.
- Añadidas lista y vista mínima de espacio con comprobación de membresía en ambas consultas y estado vacío.
- Añadidos estado `activa`/`revocada`, política central rol × acción y casos de uso reutilizables para lista/detalle.
- Ajustado el último responsable para contar solo responsables activos y el bootstrap para rechazar una membresía inicial revocada o con rol incompatible.
- Añadido `pnpm env:sync`; `env:start` mantiene `.env.local` ignorado sincronizado. Supabase CLI puede mostrar claves locales en terminal, que no deben copiarse a reportes o commits.
- Añadido modelo de invitación con estados, entrega, vigencia de siete días, correo normalizado y hash único; el token sin hash no se persiste.
- Añadidos casos de uso autorizados para crear/listar/reenviar/cancelar y una interfaz mínima solo visible/utilizable por responsables activos.
- Añadida aceptación explícita con vista GET no consumidora, token en fragmento retirado por el cliente y transacción de invitación/membresía.
- Añadido flujo de identidad nueva mediante correo Auth separado en Mailpit, sin registro público ni cambio de contraseñas existentes.
- Añadidos adaptadores locales de Mailpit y Auth administrativo; la clave de servicio permanece solo en entorno servidor ignorado.
- Añadida la acción central `abandonar_espacio` para ambos roles activos, sin conceder administración a integrantes.
- Añadido adaptador PostgreSQL de membresías con listado administrativo aislado y mutaciones transaccionales serializadas por espacio.
- Añadida interfaz `/spaces/[spaceId]/members` para activas/revocadas, cambio de rol y retiro, y autosalida desde el detalle del espacio.
- Tras autodegradarse, el usuario sale de administración; tras retirarse o abandonar, vuelve al listado. La sesión global y otras membresías no cambian.
- Añadida `access_audit_events` con acciones/tipos cerrados y sin correo o metadatos libres. Audita bootstrap, ciclo de invitación, cambio de rol, retiro y autosalida; rechazos, idempotencia y rollbacks no generan eventos de éxito.
- Revalidada dentro de la transacción la capacidad del actor para crear, reenviar o cancelar invitaciones después de tomar el bloqueo por espacio.
- Añadido `pnpm security:check` para revisar archivos versionados o versionables y ampliada la prueba E2E que busca credenciales de servidor en HTML/bundles.
- Habilitada RLS y revocados todos los privilegios a `anon`/`authenticated` en las cinco tablas de negocio E1; el servidor conserva el único acceso de aplicación a esos datos.
- Consolidada en README la instalación, arranque, migración conservadora, verificación, detención y advertencia sobre `db:reset`.
- E2.1: migraciones de pg-boss (esquema 43, generado con su CLI) y de fuentes, versiones, segmentos y bucket privado `fuentes`, con RLS y privilegios revocados.
- E2.1: módulo `sources` (validación, extracción Markdown, servicio y procesamiento), adaptadores PostgreSQL, Storage y pg-boss, y `pnpm worker`.
- E2.1: Route Handler de carga con comprobación de origen, vistas `/spaces/[spaceId]/sources` y `/sources/[sourceId]`, y acceso desde el detalle del espacio.
- E2.1: acciones centrales `consultar_fuentes` (ambos roles) y `gestionar_fuentes` (responsable).
- Dependencia añadida: `pg-boss` 12.35.0 exacta, con `pg` 8.23.0. Se descartaron versiones publicadas hace menos del plazo `minimumReleaseAge` de pnpm, sin añadir excepciones.
- E2.2: migración de páginas, extractor `pdfjs-dist` en `worker_threads`, validación de firma y límites PDF, mensajes y vistas por página.
- E2.2: generador de PDF sintéticos para pruebas y comando `pnpm sources:sample-pdfs` para la prueba manual. Dependencia añadida: `pdfjs-dist` 6.3.289 exacta, publicada el 2026-08-29, sin excepciones de antigüedad.
- E2.3: migración `manual_retries`, operaciones de reemplazo y reintento en repositorio y servicio, Route Handler de reemplazo con frontera HTTP compartida, Server Action de reintento, gestión en el detalle de la fuente y estado del reemplazo en el listado.
- E2.4: migración de eliminación y purga, cola `purgar-fuente`, purga en el worker con re-encolado de purgas atascadas, eliminación con confirmación en el detalle, bloqueo fuente→versión al completar el procesamiento y 4 acciones de auditoría de fuentes.
- E3: migración de búsqueda léxica, pgvector y embeddings; módulo `knowledge` (recuperación, prompt, validación y caso de uso); adaptadores compatibles con OpenAI y simulados; indexación en el worker; página **Asistente**; script `pnpm assistant:evaluate`; `.env.example` con nombres de variables.

## Evidencia y verificaciones reales

- `pnpm test:integration:auth`: 1 archivo y 3 pruebas aprobadas contra Supabase Auth/Mailpit reales; cubre registro público rechazado, credenciales incorrectas/correctas, recuperación, cambio de contraseña y token reutilizado.
- `pnpm test:e2e:auth`: 2 pruebas aprobadas; cubre anónimo rechazado, login, recarga con sesión, logout, recuperación completa y ausencia de la clave administrativa en HTML/bundles.
- `pnpm test:e2e`: 3 pruebas aprobadas en Chromium, incluido el smoke de E1.1.
- `pnpm verify`: formato, ESLint, TypeScript, 2 archivos/6 pruebas unitarias y build de producción aprobados.
- Comprobación manual del usuario: contraseña incorrecta rechazada; login correcto; acceso a `/protected` y sesión conservada al recargar; logout efectivo y nueva visita a `/protected` redirigida al login.
- Comprobación manual del usuario: correo de recuperación recibido en Mailpit, establecimiento de una contraseña nueva, rechazo de la anterior, login con la nueva y rechazo del enlace consumido.
- El callback de recuperación usa una respuesta intermedia no cacheable para fijar la cookie antes de navegar; el token no se traslada a la siguiente URL.
- La clave administrativa se obtiene solo en scripts/pruebas Node desde el entorno local ignorado; no existe variable `NEXT_PUBLIC_` administrativa ni importación desde `src/`.
- Supabase se reinició normalmente para aplicar Auth, restaurando su backup local. No se ejecutó `db reset`, no se eliminaron volúmenes y los datos se conservaron.
- Migración `20260917010000_e1_3_access.sql` aplicada con `migration up`: Auth conservó 1 identidad; quedaron 2 migraciones registradas y las tablas nuevas empezaron vacías.
- `pnpm test:integration`: 2 archivos y 8 pruebas aprobadas contra Auth/PostgreSQL/Mailpit reales; 5 corresponden a integridad, bootstrap, concurrencia, conflictos y aislamiento de E1.3.
- `pnpm test:e2e`: 5 pruebas aprobadas; E1.3 cubre espacio propio visible, espacio ajeno ausente/404 y estado vacío.
- `pnpm verify`: formato, ESLint, TypeScript, 3 archivos/9 pruebas unitarias y build de producción aprobados.
- El comando privado rechazó una identidad inexistente con un mensaje comprensible y sin crear datos.
- Comprobación manual del usuario: recorrido de E1.3 realizado y funcionamiento correcto confirmado; no se atribuyen otros escenarios manuales.
- Migración `20260918000000_e1_4_authorization.sql` aplicada con `migration up`, sin reset: la membresía existente quedó activa y no se alteró el espacio manual.
- `pnpm test:integration`: 2 archivos y 11 pruebas aprobadas; E1.4 cubre matriz, ausencia/revocación, rol vigente, último responsable activo y bootstrap sin reactivación.
- `pnpm test:e2e`: 6 pruebas aprobadas; con la misma sesión, un espacio revocado devuelve 404, la sesión global sigue válida y otro espacio permanece accesible.
- `pnpm verify`: formato, ESLint, TypeScript, 4 archivos/16 pruebas unitarias y build de producción aprobados.
- Consulta agregada posterior: 1 membresía persistente, 1 activa, 0 revocadas; 0 espacios de fixture E1.4. No se consultó ni registró PII.
- Comprobación manual del usuario: su espacio aparece en el listado, se abre correctamente y muestra el rol `responsable`; no se atribuyen otros escenarios manuales.
- Migración `20260918010000_e1_5_invitations.sql` aplicada con `migration up`, sin reset. Antes y después del reinicio conservador quedaron 1 identidad, 1 espacio y 1 membresía existentes; la tabla de invitaciones empezó vacía.
- `pnpm test:integration:invitations`: 1 archivo y 7 pruebas aprobadas contra PostgreSQL/Auth locales; cubre autorización, unicidad, ambos roles, correo distinto, vencimiento, tokens inválidos, entrega fallida recuperable, reenvío/cancelación, membresías activas/revocadas, doble aceptación y carreras con cancelación/reenvío.
- `pnpm test:e2e:invitations`: 3 pruebas aprobadas en Chromium contra la aplicación, Auth y Mailpit reales; cubre usuario existente como responsable, usuario nuevo como integrante, separación cuenta/aceptación, GET no consumidor, rotación, cancelación y 404 para integrante que intenta gestionar.
- `pnpm test:integration`: 3 archivos y 18 pruebas aprobadas contra Auth, PostgreSQL y Mailpit locales.
- `pnpm test:e2e`: 9 pruebas aprobadas en Chromium; incluye regresión completa de identidad, sesión, recuperación, acceso e invitaciones. La clave administrativa no apareció en HTML ni bundles accesibles al navegador.
- `pnpm verify`: formato, ESLint, TypeScript, 6 archivos/22 pruebas unitarias y build de producción aprobados.
- Consulta agregada posterior: 1 identidad, 1 espacio, 1 membresía y 0 invitaciones persistentes; los fixtures E1.5 se eliminaron sin consultar ni registrar PII.
- Primera comprobación manual del usuario: para una identidad nueva configuró la cuenta, inició sesión, aceptó la invitación y entró al espacio como `integrante`; funcionó correctamente. Esa comprobación no cubrió usuario existente, rol `responsable`, reenvío, cancelación, vencimiento ni concurrencia.
- Comprobación manual posterior del usuario: reenviar invalidó el enlace anterior, el enlace nuevo mostró la invitación pendiente y cancelar impidió aceptarla; los tres resultados fueron correctos. No se le atribuyen mediante esta comprobación pruebas de aceptación con usuario existente, rol `responsable`, vencimiento o concurrencia.
- `pnpm test:integration:memberships`: 1 archivo y 6 pruebas aprobadas contra PostgreSQL/Auth locales; cubre listado aislado, activas/revocadas, promoción, degradación, retiro, autosalida, último responsable, identificadores cruzados y carrera entre responsables con revalidación del actor.
- `pnpm test:e2e:memberships`: 3 pruebas aprobadas en Chromium con dos sesiones; cubre administración denegada al integrante, autodegradación, restauración de rol, retiro con sesión global viva y otro espacio conservado, autosalida y último responsable.
- `pnpm test:integration`: 4 archivos y 24 pruebas aprobadas; regresión completa de identidad, acceso, invitaciones y membresías contra servicios locales reales.
- `pnpm test:e2e`: 12 pruebas aprobadas; regresión completa de E1.1–E1.6, incluida la ausencia de la clave administrativa en recursos del navegador.
- `pnpm verify`: formato, ESLint, TypeScript, 7 archivos/26 pruebas unitarias y build de producción aprobados; la ruta dinámica `/spaces/[spaceId]/members` quedó incluida en el build.
- Consulta agregada posterior: 0 espacios y 0 membresías de fixtures E1.6; permanecen 1 identidad, 1 espacio, 1 membresía y 0 invitaciones persistentes. No se consultó ni registró PII.
- Comprobación manual del usuario del 2026-09-21: confirmó que la comprobación manual de E1.6 funcionó correctamente y aceptó la entrega. No se atribuyen mediante esta confirmación otros recorridos o resultados manuales.
- Migraciones `20260921000000_e1_7_access_audit.sql` y `20260921010000_e1_7_harden_data_api.sql` aplicadas con `migration up`, sin `db reset` ni eliminación de volúmenes.
- `pnpm test:integration`: 5 archivos y 26 pruebas aprobadas contra Auth, PostgreSQL y Mailpit locales; las nuevas pruebas comprueban los ocho tipos de acción, actor/espacio/objetivo/fecha, ausencia de campos personales, ausencia de eventos para rechazos o repeticiones idempotentes y cierre de las cinco tablas a los roles Data API.
- `pnpm test:e2e`: 12 pruebas aprobadas; regresión completa de E1 y ausencia de clave administrativa, URL de base y credenciales efímeras de prueba en HTML/bundles accesibles al navegador.
- `pnpm verify`: formato, ESLint, TypeScript, 7 archivos/26 pruebas unitarias, higiene de 118 archivos versionados o versionables y build de producción aprobados.
- `git diff --check` aprobado. `.env.local`, secretos temporales, dependencias, build y resultados de pruebas permanecen ignorados; la revisión de higiene no encontró correos fuera de dominios reservados en archivos versionables.
- Consulta agregada posterior: los fixtures E1.7 se eliminaron; permanecen 1 identidad, 1 espacio, 1 membresía y 0 invitaciones persistentes. No se consultó ni registró PII.
- Reverificación del 2026-10-01 sin cambios de código: 6 migraciones aplicadas, `pnpm verify` (26 unitarias, higiene de 118 archivos y build), `pnpm test:integration` 26/26, `pnpm test:e2e` 12/12 y `git diff --check` aprobados.
- Comprobación manual del usuario del 2026-10-01: revisó el diff, confirmó que la Data API rechaza con `42501` las cinco tablas E1 y recorrió desde la interfaz invitaciones, aceptación de una identidad nueva, cambios de rol, autosalida y el rechazo del último responsable; informó que todo funcionó correctamente. La consulta agregada posterior registró 7 eventos (2 `invitacion_creada`, 1 `invitacion_cancelada`, 1 `invitacion_aceptada`, 2 `rol_membresia_cambiado`, 1 `membresia_abandonada`) y 0 eventos con correos. No hubo eventos `invitacion_reenviada` ni `membresia_retirada` en ese recorrido: ambos tipos conservan solo evidencia automatizada y no se atribuyen a la comprobación manual.
- Estado agregado posterior: 2 identidades, 1 espacio, 2 membresías y 2 invitaciones; los datos del recorrido manual se conservan en la base local. No se consultó ni registró PII.
- E2.1, 2026-10-01: migraciones aplicadas con `pnpm db:migrate`, sin reset. Identidades, espacios, membresías, invitaciones y auditoría quedaron igual antes y después (2/1/2/2/7).
- E2.1: `pnpm test:integration:sources` 6/6 y `pnpm test:e2e:sources` 3/3 contra servicios locales reales, con el worker real. `pnpm verify` aprobado con 41 pruebas unitarias, higiene de 142 archivos y build. Regresión completa: `pnpm test:integration` 32/32 y `pnpm test:e2e` 15/15. `git diff --check` aprobado.
- E2.1: tras las suites quedaron 0 fuentes, 0 objetos y 0 trabajos pendientes de prueba. El arranque y la parada limpia de `pnpm worker` se comprobaron por separado.
- Comprobación manual del usuario del 2026-10-01: confirmó que la prueba manual de E2.1 funcionó correctamente y aceptó la entrega. No se le atribuyen escenarios adicionales. Estado agregado posterior: 1 fuente en estado `lista` y 1 objeto en el bucket; no se consultó contenido ni PII. No hubo cambios de código después de la verificación automática; se reutiliza esa evidencia.
- E2.2, 2026-10-01: migración aplicada sin reset y con los datos conservados. Pruebas unitarias 46/46 (extractor con pdf.js real), `pnpm test:integration` 33/33, `pnpm test:e2e` 16/16, `pnpm verify` y `git diff --check` aprobados. Tras las suites no quedaron residuos; persisten solo la fuente y el objeto de la prueba manual de E2.1.
- Comprobación manual del usuario del 2026-10-01: confirmó que la prueba manual de E2.2 funcionó correctamente y aceptó la entrega. No se le atribuyen comprobaciones adicionales. Estado agregado posterior: versiones Markdown `lista` 1, PDF `lista` 1 y PDF `fallida` 1; 3 objetos en el bucket; 0 trabajos pendientes. No se consultó contenido ni PII. Tras la verificación automática solo cambió el formato de `scripts/write-sample-pdfs.mjs`; se reutiliza esa evidencia.
- E2.3, 2026-10-01: migración aplicada sin reset y con los datos conservados (2/1/2/2/7, 3 fuentes del usuario). Pruebas unitarias 46/46, `pnpm test:integration` 34/34, `pnpm test:e2e` 17/17, `pnpm verify` y `git diff --check` aprobados. Sin residuos ni trabajos pendientes.
- Comprobación manual del usuario del 2026-10-01: confirmó que la comprobación manual de E2.3 funcionó correctamente y aceptó la entrega. No se le atribuyen escenarios adicionales. Estado agregado posterior: 3 fuentes, 3 versiones (Markdown `lista` 1, PDF `lista` 1, PDF `fallida` 1), 3 objetos y 0 trabajos pendientes; no aparecen versiones de reemplazo en la base local. Se registra solo como dato agregado, sin consultar contenido ni PII. Tras la verificación automática no cambió código; se reutiliza esa evidencia.
- E2.4, 2026-10-01: migración aplicada sin reset y con los datos conservados (2/1/2/2/7; 3 fuentes, 3 versiones, 5 segmentos y 3 objetos del usuario). Pruebas unitarias 48/48, `pnpm test:integration` 36/36, `pnpm test:e2e` 18/18, `pnpm verify` y `git diff --check` aprobados. Sin residuos ni trabajos pendientes.
- Comprobación manual del usuario del 2026-10-01: confirmó que la prueba manual de E2.4 funcionó correctamente y aceptó la entrega. No se le atribuyen pasos adicionales. Estado agregado de esta base local tras la confirmación: 3 fuentes activas, 0 eliminadas, 3 objetos y 0 trabajos pendientes.
- Aclaración del usuario del 2026-10-01: la comprobación manual de E2.3 se realizó en otro entorno; el conteo de esta base no la contradice. No se le atribuyen pasos adicionales.
- Cierre de E2 sin cambios de código después de la verificación; se reutiliza esa evidencia.
- E3, 2026-10-01 (pruebas técnicas, simuladas):
  - migración aplicada sin reset; datos conservados (2/1/2, 3 fuentes, 5 segmentos);
  - 56 pruebas unitarias, integración 42/42 (6 del asistente), navegador 20/20 (2 del asistente), `pnpm verify` y `git diff --check` aprobados;
  - una primera regresión mostró que el worker de las pruebas de fuentes generaba embeddings simulados de todos los segmentos de la base local. Se corrigió y se retiraron esas 5 filas simuladas.
- **Evaluación con modelo real de E3 (2026-10-01):** OpenAI `gpt-4.1-mini` y `text-embedding-3-small`, elegidos y configurados por el usuario. Directa y parafraseada respondidas con cita correcta, sin respuesta → insuficiente, otro espacio rechazado. 3 llamadas de conversación (1319/126 tokens). Ver el [documento 06](06-ia-y-evaluacion.md#evaluación-de-e3).
- La configuración de IA estaba en `.env.local`, que `env:sync` sobrescribe. Sus líneas se copiaron, sin mostrar valores, a `.env.development.local` (ignorado, permisos 600).

- Comprobación manual del usuario del 2026-10-01: confirmó que la comprobación manual del asistente con IA real funcionó correctamente y aceptó la entrega. No se le atribuyen escenarios adicionales. Estado agregado posterior: 3 fuentes, 5 segmentos y 5 embeddings `openai:text-embedding-3-small`.

- E4.1, 2026-10-01:
  - pruebas técnicas: 64 unitarias, integración 48/48 (6 de rutas), navegador 22/22 (2 de rutas), `pnpm verify` y `git diff --check`; datos intactos (2/1/2, 3 fuentes, 5 segmentos, 5 embeddings) y sin rutas ni trabajos residuales;
  - evaluación con modelo real: 2 generaciones (objetivo cubierto → borrador correcto con citas; no cubierto → insuficiente), 1017/590 tokens;
  - Comprobación manual del usuario del 2026-10-01: confirmó que la comprobación manual de E4.1 funcionó correctamente y aceptó la entrega. No se le atribuyen escenarios adicionales. Estado agregado posterior de su espacio: 3 rutas (1 lista y 2 con evidencia insuficiente) y 4 intentos de generación registrados.
- Aislamiento de pruebas (2026-10-01): `pnpm test:integration:isolation` 3/3, integración 51/51, `pnpm verify` y navegador afectado en modo simulado (fuentes 6/6, rutas 2/2, asistente 2/2). Esta ejecución no dejó trabajos en las colas normales. Incidente previo con llamadas probables registrado en el documento 07.

- E5.1, 2026-10-01 (pruebas técnicas): 67 unitarias, integración 55/55 (4 de aprendizaje), navegador 24/24 (2 de aprendizaje), `pnpm verify` y `git diff --check`. Sin procesos de desarrollo en marcha, sin trabajos fuera del namespace `pruebas` y sin progreso residual.
- Comprobación manual del usuario del 2026-10-01: confirmó que realizó las pruebas manuales de E5.1 y funcionaron correctamente, y aceptó la entrega. No se le atribuyen comprobaciones adicionales. Estado agregado posterior: 1 ruta publicada, 1 progreso completado y 4 intentos.

- E5.2, 2026-10-01 (pruebas técnicas): 69 unitarias, `pnpm test:integration:team-progress` 2/2, integración 57/57, `pnpm test:e2e:learning` 3/3, `pnpm test:e2e:routes` 2/2, `pnpm verify` y `git diff --check`. Sin procesos de desarrollo en marcha, sin trabajos fuera de `pruebas` y con los datos conservados.
- Comprobación manual del usuario del 2026-10-01: confirmó que la comprobación manual de E5.2 funcionó correctamente y aceptó la entrega. No se le atribuyen escenarios adicionales. Estado agregado posterior: 2 membresías activas, 1 retirada y 1 progreso completado.

- E5.3, 2026-10-01:
  - pruebas técnicas: 71 unitarias, `pnpm test:integration:step-help` 5/5, integración 62/62, navegador 25/25 (aprendizaje 3/3), tipos, lint, Prettier y `pnpm build`. Sin procesos de desarrollo en marcha, sin trabajos fuera de `pruebas` y con los datos conservados (1 progreso, 4 intentos, 5 embeddings);
  - evaluación con modelo real: 2 llamadas (1257/150 tokens), sin embeddings. Pistas: sin letra, pero con la conclusión deducida del fragmento. Explicación: correcta y citada (documento 06);
  - después de la evaluación se reforzaron las instrucciones de orientación; el prompt reforzado no se reevaluó con el modelo real;
  - cambio de etiqueta a “Ayuda para comprender”: tipos, lint y Prettier de lo afectado y `pnpm test:e2e:learning` 3/3; el resto de la evidencia se reutiliza;
  - Comprobación manual del usuario del 2026-10-01: confirmó que la comprobación manual de E5.3 funcionó correctamente y aceptó la entrega. No se le atribuyen escenarios adicionales. Aceptó como limitación del prototipo que la ayuda previa pueda revelar o permitir deducir la respuesta, sin más barreras ni evaluaciones de pago por ahora.

- E5.4, 2026-10-01:
  - pruebas técnicas: 72 unitarias, integración 62/62, navegador 25/25, `pnpm verify` y `git diff --check`. Sin procesos de desarrollo en marcha, sin trabajos nuevos fuera de `pruebas` y con los datos conservados (3 rutas y sus pasos sin código, 1 progreso, 4 intentos);
  - evaluación con modelo real: 1 generación (678/38 tokens), sin embeddings; resultado “insuficiente”, sin código generado (documento 06);
  - corrección del 2026-10-03 (ayuda con “Código del paso”): 73 unitarias, integración 63/63, `pnpm test:e2e:learning` 3/3, `pnpm test:e2e:assistant` 2/2 y `pnpm verify`; sin llamadas reales;
  - Comprobación manual del usuario del 2026-10-03: confirmó que la corrección de la ayuda sobre el código y la prueba manual de E5.4 funcionan correctamente, y aceptó la entrega. No se le atribuyen pruebas adicionales.
  - pendiente: La generación automática de pasos con código queda pendiente de una evaluación real exitosa: la única generación real devolvió “insuficiente” y la confirmación manual no sustituye esa evidencia.

- E5.5, 2026-10-06:
  - pruebas técnicas: 76 unitarias, integración 65/65, navegador 26/26, `pnpm verify` y `git diff --check`; tras el ajuste de tipos solicitados: 78 unitarias, integración 66/66 y navegador 26/26; tras la corrección de mensajes: integración 66/66 y navegador 27/27. Sin procesos de desarrollo en marcha, sin trabajos nuevos fuera de `pruebas` y con los datos conservados (pasos existentes como opción múltiple, 2 progresos y 5 intentos);
  - evaluación con modelo real: primera generación solo con opción múltiple (1032/804 tokens); con tipos solicitados, la evaluación real con tipos solicitados (2026-10-06, 1037/1149 tokens) generó 2 pasos de lectura de código y 1 de completar con solución y citas coherentes, pero la lección del paso de completar mostraba el código original con la solución (documento 06);
  - Comprobación manual del usuario del 2026-10-06: confirmó que la comprobación manual de E5.5 y la recuperación de rutas fallidas funcionan correctamente, y aceptó la entrega. No se le atribuyen escenarios adicionales.
  - Limitaciones que se conservan: la corrección es solo una comparación textual (no reconoce soluciones equivalentes); la evaluación real fue pequeña (2 generaciones, una sin código y otra con la solución visible en la lección); y la validación de solución visible no se reevaluó con el modelo real.

- RF-10, 2026-10-06:
  - pruebas técnicas: 83 unitarias, `pnpm test:integration:usage` 8/8 (proveedores falsos), integración 75/75, navegador 28/28, `pnpm verify` y `git diff --check`. Sin procesos de desarrollo en marcha; ningún registro de uso en el prototipo (`local` en 0), y los datos y las rutas se conservan;
  - evaluación con modelo real: no aplica (sin llamadas de pago);
  - Comprobación manual del usuario del 2026-10-06: confirmó que su comprobación manual del control de consumo funcionó correctamente y aceptó RF-10 para el prototipo local. No se le atribuyen escenarios adicionales.

## No realizado

No se implementaron ejecución de código, comparación semántica de respuestas, expresiones regulares configurables, filtro posterior de respuestas que revelen la opción, detalle por paso o por respuesta en el progreso del equipo, rankings, gráficos, exportación, reinicio de rutas, ejercicios de código, gamificación, versiones nuevas de rutas, historial de conversaciones, límites acumulados de gasto, umbral de similitud, OCR, papelera, descarga de originales, panel de auditoría, despliegue ni proveedor alojado.

## Próxima tarea concreta

Preparar la demostración completa con documentos sintéticos (guion y fuente de demostración) y acordar la siguiente entrega pequeña; sin piloto, despliegue ni servicios contratados.

## Decisiones que requieren aprobación

- **Siguientes entregas:** reinicio de rutas y actualización de una ruta publicada con una versión nueva (PEN-04).
- **Antes de ampliar el uso de IA:** límite de gasto acumulado y consultas por usuario (PEN-08).
- **Antes de datos reales o despliegue:** objetos huérfanos (PEN-12) y retención, incluidos progreso y contenido derivado (PEN-06).

## Pendientes menores de E1

No están resueltos. No afectan al comportamiento y no implican un rediseño de identidad.

- La portada (`src/app/page.tsx`) y `/spaces` muestran todavía el texto “Acceso local E1.6”.
- `supabase/config.toml` declara `minimum_password_length = 6`, mientras la aplicación y `auth:create-local-user` exigen 8 caracteres.

## Estado de Git y operación

E5.1 está cerrada en `68d3163`, E5.2 en `e9169d9` y E5.3 en `afd8cb5`, todos sin push. E5.4 está cerrada en `183502a`, sin push. E5.5 está cerrada en `35dfd36`, sin push. RF-10 está cerrado en el commit local siguiente, sin push. `.env.local`, `.env.development.local`, secretos, dependencias, build y resultados de prueba permanecen ignorados. Las pruebas usan el namespace `pruebas` y no reutilizan un `pnpm dev` en marcha.

## Formato para futuras sesiones

Fecha; tarea realizada; archivos afectados; decisiones y fundamento; verificaciones realmente ejecutadas; bloqueos; siguiente paso. Enlazar especificaciones e historial sin duplicar reglas.
