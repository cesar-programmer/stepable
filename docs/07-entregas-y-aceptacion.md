# Entregas y aceptación

Estado: secuencia inicial de planificación; sin fechas comprometidas.
Actualizado: 2026-10-01.

## Etapa actual: E1 cerrada localmente

Arquitectura modular, stack y ciclo local de acceso están aceptados en ADR-003. E1.1–E1.6 cuentan con evidencia automatizada y confirmaciones manuales del usuario. E1.7 fue revisada y aceptada por el usuario el 2026-10-01, con evidencia automatizada y una comprobación manual delimitada; E1 queda cerrada localmente. E2.1 (Markdown) está cerrada localmente tras la comprobación manual del usuario. E2.2 (PDF) está cerrada tras la comprobación manual del usuario. E2.3 está cerrada tras la confirmación manual del usuario. E2.4 está cerrada y, con ella, E2 queda cerrada para el prototipo local. E3 no está iniciada. Piloto y proveedores permanecen fuera del alcance.

| Entrega | Requisitos | Evidencia propuesta de cierre |
| --- | --- | --- |
| E1 Base y acceso | RF-01, RF-02 | CA-01: dos roles acceden a su espacio; accesos no autorizados rechazados, incluida manipulación de identificadores |
| E2 Fuentes | RF-03 | CA-02: archivo permitido llega a listo, error se ve y se puede reintentar sin duplicar resultados |
| E3 Asistente | RF-08 | CA-03: preguntas de referencia producen evidencia resoluble; preguntas sin respaldo reconocen insuficiencia; aislamiento por espacio. Prototipo local cerrado el 2026-10-01; historial de conversaciones (“chats aislados” persistentes) pospuesto |
| E4 Autoría | RF-04, RF-05 | CA-04: borrador editable, publicación solo por responsable y versión publicada estable. E4.1 cerrada en el prototipo local el 2026-10-01 |
| E5 Aprendizaje | RF-06, RF-07, RF-09 | CA-05: actividad evaluada con criterios revisados, progreso retomable y seguimiento autorizado. E5.1 (recorrido individual) cerrada el 2026-10-01; seguimiento del equipo (E5.2) pendiente |
| E6 Piloto | Recorrido completo | CA-06: prueba documentada con usuarios invitados, incidencias y consumo registrado |

RF-10 es transversal: errores y límites deben incorporarse en las entregas que consumen recursos. El chat contextual de lecciones se integra en E5; E3 entrega el chat general.

## Regla de cierre

Una entrega no está completada por tener archivos. Requiere comportamiento observado, verificaciones pertinentes y límites documentados. E1.1–E1.6 tienen evidencia automatizada y comprobación manual. E1.7 tiene evidencia automatizada y comprobación manual; las etapas posteriores todavía no tienen resultados.

Las pruebas deben cubrir aislamiento, permisos, referencias/versiones, recuperación de fallos y progreso. No fijar un número de pruebas como objetivo de calidad.

La V0 funcional termina cuando onboarding y consulta permanente operan juntos. Utilidad comercial y disposición a pagar siguen siendo hipótesis hasta obtener evidencia externa.

## Plan ejecutable de E1

E1 no incluye fuentes, procesamiento, archivos, búsqueda ni IA. Cada paso produce una porción demostrable y conserva el sistema ejecutable. [ADR-003](decisiones/ADR-003-stack-y-acceso-e1.md) acepta stack y ciclo local de acceso; E1.7 documenta su cierre técnico.

| Paso | Trabajo | Criterio de aceptación | Pruebas pertinentes | Resultado esperado |
| --- | --- | --- | --- | --- |
| E1.0 Cerrar contrato | Resolver ADR-002/ADR-003, vigencia de invitación y política del último responsable | No quedan decisiones de comportamiento E1 ambiguas; PEN-02/PEN-05 se cierran o se dividen con dueño | Revisión cruzada RF-01/RF-02, RN-03 y RN-08–RN-18 | Base aprobada para implementar sin contratar ni desplegar |
| E1.1 Base reproducible | Crear workspace, cascarón Next.js, configuración validada y una pila Supabase CLI local con Postgres/Auth/Mailpit; definir un único historial SQL | Un desarrollador nuevo puede iniciar/detener entorno, migrar desde cero y ejecutar verificaciones documentadas sin servicios duplicados | Instalación limpia, `env:start/status/stop`, reset local, lint, tipos y prueba mínima | Proyecto ejecutable localmente; sin cuentas, espacios, permisos ni flujo de bootstrap implementados todavía |
| E1.2 Identidad | Integrar Supabase Auth local detrás de un adaptador: usuario operativo de prueba, login, sesión, recuperación, cambio de contraseña y logout; sin registro público | Usuario válido entra/sale/recupera; credenciales incorrectas, acceso anónimo y enlaces inválidos/usados se rechazan; la página protegida valida identidad en servidor | Unidades de entrada, integración con Auth/Mailpit reales, E2E de sesión/recuperación y revisión de clave administrativa | Identidad autenticada y comprobable localmente, aún separada de espacios y autorización |
| E1.3 Espacios y membresías | Persistir perfiles, espacios, membresías, roles y bootstrap | Primer responsable/espacio se crea una sola vez; usuario puede listar solo sus espacios | Restricciones/índices en PostgreSQL real, concurrencia de bootstrap, manipulación de ID | Fuente de verdad de acceso por espacio |
| E1.4 Autorización | Implementar políticas centrales y matriz mínima | Responsable e integrante acceden solo a acciones permitidas; sin membresía se deniega por defecto | Tabla de pruebas rol × acción, acceso horizontal/vertical, membresía retirada con sesión viva | CA-01 cubierto en backend, no solo en UI |
| E1.5 Invitaciones | Crear, enviar/capturar localmente, aceptar, reenviar y revocar invitaciones | Coincidencia de correo, token único/hasheado, expiración, aceptación atómica e idempotente | Token alterado/usado/revocado/vencido, correo distinto, carreras de doble aceptación, reenvío | Flujo completo para incorporar usuarios |
| E1.6 Administración | Listar miembros, cambiar rol y retirar respetando último responsable | Dos responsables pueden transferir control; no se deja el espacio huérfano; retiro surte efecto en la siguiente solicitud | Concurrencia al degradar/retirar, autosalida, otro espacio, integrante intentando administrar | Ciclo mínimo de membresía operable |
| E1.7 Cierre local | Auditar eventos, revisar errores/secretos, ejecutar suite y documentar operación | CA-01 y escenarios RF-01/RF-02 tienen evidencia repetible; no hay secretos ni PII de prueba en repo | Suite completa, revisión de logs, prueba manual de recuperación/correo capturado | E1 implementada y probada localmente, no desplegada |
| E1.8 Preparar piloto | Solo tras autorización separada: elegir y configurar alojamiento, base/Auth y correo externo; backup y límites | Presupuesto y alertas configurados; restauración comprobada; datos autorizados | Smoke test remoto, aislamiento, envío real acotado, exportar/restaurar | Candidato de piloto; proveedores y costos siguen pendientes; no forma parte de la autorización actual |

### Evidencia de cierre de CA-01

La evidencia de E1 queda relacionada así:

- **RF-01 / identidad e invitación:** integración real de Auth/Mailpit y E2E cubren credenciales válidas e inválidas, sesión, recuperación, enlace consumido, registro público cerrado, usuario existente/nuevo y aceptación explícita. Las comprobaciones manuales confirmadas de E1.2 y E1.5 complementan, pero no sustituyen, esa evidencia.
- **RF-02 / espacios, membresías y roles:** integración PostgreSQL y E2E cubren bootstrap, ambos roles, aislamiento por identificador, estado vacío, revocación con sesión viva, invitaciones, cambio/retiro/autosalida y último responsable. Las comprobaciones manuales confirmadas de E1.3, E1.4 y E1.6 se conservan separadas.
- **CA-01:** la matriz de autorización se ejerce en integración y los recorridos web prueban acceso de responsable/integrante y rechazo de accesos horizontales o revocados. E1.7 añade auditoría transaccional de las mutaciones, revisión automatizada de archivos versionables y búsqueda de credenciales en recursos del navegador.

La regresión final de E1.7 aprobó 26 pruebas de integración y 12 de navegador; `pnpm verify` cubre formato, lint, tipos, 26 pruebas unitarias, higiene y build. Las migraciones incrementales se aplicaron sin reset y la prueba de auditoría usa fixtures efímeros. Un despliegue o una captura de pantalla por sí solos no cierran E1. E1.8 requiere autorización posterior porque crea servicios y puede generar cargos.

### Resultado de E1.1

Completado el 2026-09-17: repositorio Git local, aplicación Next.js mínima, configuración tipada, dependencias bloqueadas, Supabase CLI con PostgreSQL/Auth/Mailpit, red limitada a `127.0.0.1`, migración/seed base, scripts de ciclo de vida, formato/lint/tipos/unidades/build, arranque HTTP y smoke E2E.

En E1.1 no se implementaron registro/login, bootstrap, espacios, membresías, roles, invitaciones, correo de aplicación, RLS de negocio, E2 ni despliegue. La identidad se añadió después, exclusivamente en E1.2.

### Resultado de E1.2

Implementado y verificado automáticamente el 2026-09-17: Supabase Auth local con correo/contraseña, registro público bloqueado, creación operativa e interactiva de usuario de prueba, cookies SSR, validación de identidad en servidor, login, persistencia al recargar, logout, recuperación por correo capturado en Mailpit, cambio de contraseña y rechazo de token inválido o reutilizado. El SDK queda detrás del adaptador de identidad y la clave administrativa se usa solo en scripts/pruebas Node locales.

El usuario comprobó manualmente el rechazo de una contraseña incorrecta, el login correcto, el acceso protegido, la persistencia de sesión al recargar, el logout con redirección al login, la recuperación, el cambio de contraseña, el rechazo de la contraseña anterior, la aceptación de la nueva y el rechazo del enlace consumido. E1.2 queda cerrada.

No se implementaron espacios, perfiles de producto, membresías, roles, invitaciones de Stepable ni autorización por espacio. E1.2 no autoriza E1.3.

### Resultado de E1.3

Implementado y verificado automáticamente el 2026-09-17: migración incremental para perfiles, espacios y membresías; roles cerrados por espacio; primer responsable obligatorio; comando privado para una identidad existente; transacción idempotente y serializada por `slug`; lista y detalle filtrados por membresía; estado vacío sin espacios.

La migración se aplicó sin reset y conservó la identidad Auth existente. Las pruebas reales cubren vínculo perfil/identidad, restricciones, atomicidad, repetición concurrente, conflictos, identidad inexistente, manipulación de UUID y estado vacío. El 2026-09-18 el usuario confirmó que realizó la comprobación manual de E1.3 y funcionó correctamente. E1.3 queda cerrada y no autoriza E1.4.

### Resultado de E1.4

Implementado y verificado automáticamente el 2026-09-18: política central con acciones explícitas para consultar espacios, gestionar invitaciones y gestionar miembros; denegación predeterminada; membresías activas/revocadas; listado y detalle autorizados desde identidad servidor y estado vigente en PostgreSQL.

La migración incremental convirtió las membresías existentes en activas, ajustó el último responsable para contar solo responsables activos y se aplicó sin reset. Los fixtures controlados cubren matriz rol × acción, rol/acción desconocidos, ausencia, revocación, cambio de rol en la siguiente consulta, aislamiento, 404, sesión global conservada, otro espacio todavía accesible, último responsable activo y bootstrap que no reactiva. No existen endpoints o interfaces de invitación/administración.

El usuario comprobó manualmente que su espacio continúa en el listado, puede abrirlo y conserva el rol `responsable`. No se atribuyen a esta comprobación otros escenarios. E1.4 queda cerrada y no autoriza E1.5.

### Resultado de E1.5

Implementado y verificado automáticamente el 2026-09-18: creación, lista, reenvío y cancelación de invitaciones desde el espacio, autorizadas por la política central solo para responsables activos. Cada enlace dura siete días, contiene un token aleatorio en el fragmento y la base conserva únicamente su hash; un GET no consume la invitación y el reenvío invalida el enlace previo.

La aceptación exige acción explícita, sesión con correo verificado coincidente y una transacción que consume la invitación junto con la creación o reactivación de la membresía. Una membresía activa conserva su rol; el mismo rol informa pertenencia y uno distinto produce conflicto. Un enlace ya consumido devuelve el resultado existente para la misma identidad y nunca reactiva una membresía retirada después.

El alta de una identidad nueva usa un correo separado de Supabase Auth en Mailpit y no acepta por sí misma el espacio. Las pruebas reales cubren usuario existente/nuevo, ambos roles, entrega fallida recuperable, rotación, cancelación, vencimiento, tokens y correos incorrectos, aislamiento, membresías activas/revocadas, doble aceptación y carreras con reenvío/cancelación. La migración se aplicó sin reset y conservó la identidad, el espacio y la membresía manuales.

El 2026-09-19 el usuario comprobó manualmente dos grupos separados. Primero, configuró una identidad nueva, inició sesión, aceptó la invitación y entró al espacio como `integrante`. Después comprobó que reenviar invalida el enlace anterior, el enlace nuevo muestra la invitación pendiente y cancelar impide aceptarla. Ambos resultados fueron correctos. No se atribuyen al usuario pruebas manuales de usuario existente, rol `responsable`, vencimiento o concurrencia; esos escenarios conservan únicamente evidencia automatizada. E1.5 quedó cerrada; E1.6 recibió autorización separada posteriormente.

### Resultado de E1.6

Implementado y verificado automáticamente el 2026-09-19: listado administrativo de membresías activas y revocadas, cambios de rol, retiro y autosalida. Solo un responsable activo puede administrar; ambos roles activos pueden abandonar únicamente su propia membresía. Una revocada se muestra sin controles de mutación y solo puede reactivarse mediante una nueva invitación.

Las operaciones administrativas se serializan por espacio y vuelven a comprobar dentro de la transacción la membresía y rol del actor, la membresía objetivo y el número de responsables activos. Las pruebas reales cubren promoción, degradación, retiro, autosalida, último responsable, identificadores cruzados, actor que pierde permiso en una carrera, sesión abierta tras el cambio, conservación de otro espacio y ausencia de reactivación directa. No se requirió migración de datos porque E1.4 ya introdujo estado e invariante.

La regresión completa aprobó 24 pruebas de integración y 12 de navegador; las unidades, tipos, lint, formato y build se registran en el estado actual. El 2026-09-21 el usuario confirmó que la comprobación manual de E1.6 funcionó correctamente y aceptó la entrega. No se le atribuyen comprobaciones manuales adicionales. E1.6 queda cerrada; E1.7 requiere autorización y trabajo separados.

### Resultado de E1.7

Implementado y verificado automáticamente el 2026-09-21 sobre el commit base `8387cefc20495a7dba10a2a0ef9753cbb1a9376d`: tabla de auditoría con acciones y tipos cerrados, solo identificadores y fecha; registro de creación de espacio, ciclo de invitación, cambio de rol, retiro y autosalida dentro de la misma transacción que confirma cada mutación. Repeticiones idempotentes, rechazos y rollbacks no generan eventos de éxito.

La revisión de cierre corrigió la revalidación transaccional de permisos al crear, reenviar o cancelar invitaciones si el actor pierde acceso mientras espera. También cerró a `anon`/`authenticated` la vía Data API sobre todas las tablas E1 con RLS y revocación de privilegios, amplió la prueba de navegador para buscar credenciales de servidor en HTML/bundles y añadió una comprobación de higiene de archivos versionados o versionables. La operación diaria, migraciones conservadoras, suites y detención están consolidadas en README.

Pasaron 26 pruebas de integración, 12 de navegador y 26 unitarias, además de formato, lint, tipos, higiene, build y `git diff --check`. Las migraciones se aplicaron sin `db reset`; los fixtures se eliminaron y los datos locales existentes se conservaron. Reverificación del 2026-10-01 sin cambios de código: 6 migraciones aplicadas, `pnpm verify` (26 unitarias, higiene de 118 archivos y build), `pnpm test:integration` 26/26, `pnpm test:e2e` 12/12 y `git diff --check` aprobados. Comprobación manual del usuario del 2026-10-01: revisó el diff, confirmó que la Data API rechaza con `42501` las cinco tablas E1 y recorrió desde la interfaz invitaciones, aceptación de una identidad nueva, cambios de rol, autosalida y el rechazo del último responsable; informó que todo funcionó correctamente. La consulta agregada posterior registró 7 eventos (2 `invitacion_creada`, 1 `invitacion_cancelada`, 1 `invitacion_aceptada`, 2 `rol_membresia_cambiado`, 1 `membresia_abandonada`) y 0 eventos con correos. No hubo eventos `invitacion_reenviada` ni `membresia_retirada` en ese recorrido: ambos tipos conservan solo evidencia automatizada y no se atribuyen a la comprobación manual. E1.7 y E1 quedan cerradas localmente.

## Plan de E2

Estado: **E2 cerrada para el prototipo local** el 2026-10-01 (E2.1–E2.4), con las limitaciones de abajo y del [documento 04 §19](04-arquitectura.md#limitaciones-conocidas-de-e21). Según [ADR-004](decisiones/ADR-004-fuentes-locales-e2.md).

| Paso | Trabajo | Estado |
| --- | --- | --- |
| E2.1 Recorrido mínimo Markdown | Fuentes, versiones, segmentos, bucket privado, carga por Route Handler, pg-boss y `pnpm worker`, extracción Markdown, vistas por rol | Cerrada: verificación automática y comprobación manual del usuario |
| E2.2 PDF con texto | `pdfjs-dist` en `worker_threads`, segmentos por página, firma, ≤ 8 MiB, ≤ 200 páginas, sin cifrado y sin OCR | Cerrada: verificación automática y comprobación manual del usuario |
| E2.3 Reemplazo y reintentos | Versión candidata, cambio atómico, reemplazo fallido sin pérdida, hasta 3 reintentos manuales, conservación de versiones anteriores | Cerrada: verificación automática y confirmación manual del usuario |
| E2.4 Eliminación y cierre | Eliminación con confirmación, retiro inmediato, purga por el worker, metadatos mínimos y auditoría de fuentes | Cerrada: verificación automática y confirmación manual del usuario; huérfanos aceptados como limitación (PEN-12) |

### E2.1 · Criterios de aceptación

1. Un responsable activo carga un `.md` válido de hasta 1 MiB, incluso uno corto. La fuente pasa por “En cola”, “Procesando” y “Lista”, y muestra cuántas secciones tiene.
2. Un `.md` vacío, solo con espacios en blanco o con bytes no UTF-8 termina en “Falló” con un motivo comprensible y sin segmentos.
3. Un archivo vacío, de más de 1 MiB o con extensión no admitida se rechaza en la carga. No queda fila ni objeto.
4. Con el worker detenido, la carga queda “En cola” y se procesa al arrancarlo. Un intento interrumpido lo reintenta pg-boss, y repetir el cierre no duplica segmentos.
5. Un integrante activo lista y lee solo las fuentes listas, sin controles de gestión. La carga directa de un integrante, de un usuario ajeno o con identificadores cruzados se rechaza con 404, y con 403 si el origen es ajeno.
6. Los roles `anon`/`authenticated` no leen las tablas nuevas, no usan el esquema `pgboss` y no listan ni descargan el bucket.
7. Ningún log contiene texto ni títulos de documentos.

### Resultado de E2.1

Implementado y verificado automáticamente el 2026-10-01. El usuario ajustó la propuesta en tres puntos:
- se aceptan documentos cortos y solo se rechazan los vacíos;
- la cola usa pg-boss en lugar de una cola propia;
- conservación y eliminación se deciden en E2.3 y E2.4.

Evidencia:

- **Migraciones:** `20261001000000_e2_1_pgboss.sql` y `20261001010000_e2_1_sources.sql`, aplicadas con `pnpm db:migrate`, sin reset. Los conteos de identidades, espacios, membresías, invitaciones y auditoría quedaron iguales antes y después (2/1/2/2/7).
- **`pnpm test:integration:sources`, 6 pruebas contra PostgreSQL, Storage y pg-boss reales:**
  - carga encolada en la misma transacción y procesada por el worker;
  - contenido corto aceptado;
  - vacío y no UTF-8 marcados `fallida`;
  - rechazos sin objeto;
  - aislamiento por rol, espacio, identificadores cruzados y membresía revocada;
  - cierre idempotente y barrido de versiones atascadas;
  - tablas, bucket y `pgboss` cerrados a `anon`/`authenticated`.
- **`pnpm test:e2e:sources`, 3 pruebas en Chromium con el worker real:**
  - carga, procesamiento y lectura por el responsable;
  - rechazo `.txt` y fallo UTF-8 visible;
  - lectura del integrante limitada a fuentes listas;
  - 404 para la carga del integrante y para otro espacio;
  - 403 para un origen ajeno.
- **Regresión:** `pnpm verify` (41 pruebas unitarias, higiene y build), `pnpm test:integration` 32/32, `pnpm test:e2e` 15/15 y `git diff --check`.
- **Residuos:** las pruebas no dejaron fuentes, objetos ni trabajos pendientes.

Comprobación manual del usuario del 2026-10-01: confirmó que la prueba manual de E2.1 funcionó correctamente y aceptó la entrega. No se le atribuyen escenarios adicionales. Estado agregado posterior: 1 fuente en estado `lista` y 1 objeto en el bucket; no se consultó contenido ni PII. E2.1 queda cerrada localmente. Las limitaciones están en el [documento 04 §19](04-arquitectura.md#limitaciones-conocidas-de-e21).

### E2.1 · Prueba manual

1. Ejecutar `pnpm env:start` y `pnpm db:migrate`. Luego, en dos terminales, `pnpm dev` y `pnpm worker`.
2. Como responsable, abrir el espacio y luego **Fuentes**. Cargar un `.md` sintético con dos o tres encabezados y comprobar que llega a “Lista” con ese número de secciones. Abrirlo y ver el texto por secciones.
3. Cargar un `.md` que contenga solo espacios y comprobar “Falló” con el motivo “El archivo no contiene texto.”. Cargar un `.txt` y comprobar el rechazo.
4. Detener el worker (Ctrl+C), cargar otro `.md`, ver “En cola”, arrancar `pnpm worker` y comprobar que pasa a “Lista”.
5. Con un integrante del espacio, que puede requerir una nueva invitación, comprobar que solo ve y lee las fuentes listas y no ve el formulario.

### Resultado de E2.2

Implementado y verificado automáticamente el 2026-10-01, con los límites aceptados por el usuario: ≤ 8 MiB, ≤ 200 páginas, sin cifrar y sin OCR. Se reutilizan el almacenamiento, la cola, el worker, los permisos, los estados y la interfaz de E2.1.

Evidencia:

- **Migración** `20261001020000_e2_2_pdf_sources.sql`: número de páginas y ubicación por página, aplicada con `pnpm db:migrate`, sin reset. Los datos locales quedaron igual (2/1/2/2/7, 1 fuente y 3 segmentos).
- **Pruebas unitarias del extractor con pdf.js real:**
  - texto por página;
  - cifrado con contraseña de usuario o de propietario;
  - dañado;
  - 201 páginas;
  - tiempo agotado.
- **Pruebas unitarias de validación y procesamiento:** firma y límite de 8 MiB, páginas sin texto omitidas, sin texto, cifrado y tiempo agotado transitorio.
- **`pnpm test:integration:sources`, 7/7 con la cola y el worker reales:**
  - PDF de 3 páginas con 2 con texto, leído por un integrante;
  - PDF corto aceptado;
  - escaneado: `sin_texto_extraible`;
  - cifrado: `pdf_protegido`;
  - `.pdf` sin firma y PDF de más de 8 MiB rechazados sin objeto.
- **`pnpm test:e2e:sources`, 4/4:**
  - PDF con texto hasta “Lista” y lectura por página;
  - PDF escaneado con su motivo;
  - Markdown y permisos sin cambios.
- **Regresión:** `pnpm verify` (46 pruebas unitarias, higiene y build), `pnpm test:integration` 33/33, `pnpm test:e2e` 16/16 y `git diff --check`.
- **Residuos:** las pruebas no dejaron fuentes, objetos ni trabajos pendientes.

Comprobación manual del usuario del 2026-10-01: confirmó que la prueba manual de E2.2 funcionó correctamente y aceptó la entrega. No se le atribuyen comprobaciones adicionales. Estado agregado posterior: versiones Markdown `lista` 1, PDF `lista` 1 y PDF `fallida` 1; 3 objetos en el bucket; 0 trabajos pendientes. No se consultó contenido ni PII. E2.2 queda cerrada localmente.

### E2.2 · Prueba manual

1. Ejecutar `pnpm db:migrate` y `pnpm sources:sample-pdfs`, que escribe PDF sintéticos en la carpeta temporal del sistema. Luego, en dos terminales, `pnpm dev` y `pnpm worker`.
2. Como responsable, en **Fuentes**, cargar `manual-con-texto.pdf`. Debe llegar a “Lista” con “3 páginas · 2 con texto”; al abrirlo se ven las páginas 1 y 3. Cargar `corto.pdf`: también queda “Lista”.
3. Cargar `escaneado-sin-texto.pdf`, `cifrado.pdf` y `danado.pdf`: cada uno debe mostrar “Falló” con su motivo. Cargar `demasiadas-paginas.pdf`: “Falló” por el límite de 200 páginas.
4. Cargar un `.md` para confirmar que Markdown sigue funcionando.

### Resultado de E2.3

Implementado y verificado automáticamente el 2026-10-01 según las reglas indicadas por el usuario. Solo responsables activos reemplazan y reintentan. La identidad de la fuente se conserva. La vigente sigue disponible mientras se procesa la candidata y cambia de forma atómica. Una candidata fallida no afecta a la vigente y muestra su motivo. Hay una sola candidata en curso y hasta 3 reintentos manuales sin trabajos duplicados. Las versiones anteriores se conservan sin historial visible.

Evidencia:

- **Migración** `20261001030000_e2_3_source_replacement.sql` (`manual_retries`), aplicada con `pnpm db:migrate`, sin reset; datos locales conservados.
- **`pnpm test:integration:sources`, 8/8.** La nueva prueba, con el worker detenido y reanudado para observar el estado intermedio, cubre:
  - candidata pendiente con la vigente legible por el integrante;
  - segunda carga rechazada;
  - doble reintento sin segundo trabajo;
  - rechazo de integrante y de usuario ajeno;
  - cambio atómico Markdown → PDF con v1 `reemplazada` conservada;
  - `sin_cambios`;
  - candidata fallida sin pérdida;
  - doble clic con un solo trabajo;
  - tres reintentos y el límite;
  - archivo corregido que deja `descartada` a la fallida;
  - primera versión fallida corregida.
- **`pnpm test:e2e:sources`, 5/5:**
  - reemplazo por PDF con el contenido nuevo visible;
  - reemplazo fallido con el motivo y el contenido anterior;
  - reintento que descuenta un intento;
  - integrante sin controles y con 404 al reemplazar por petición directa.
- **Regresión:** `pnpm verify` (46 pruebas unitarias, higiene y build), `pnpm test:integration` 34/34, `pnpm test:e2e` 17/17 y `git diff --check`. Sin residuos de prueba.

Comprobación manual del usuario del 2026-10-01: confirmó que la comprobación manual de E2.3 funcionó correctamente y aceptó la entrega. No se le atribuyen escenarios adicionales. Estado agregado posterior: 3 fuentes, 3 versiones (Markdown `lista` 1, PDF `lista` 1, PDF `fallida` 1), 3 objetos y 0 trabajos pendientes; no aparecen versiones de reemplazo en la base local. Se registra solo como dato agregado, sin consultar contenido ni PII. E2.3 queda cerrada localmente. Aclaración del usuario del 2026-10-01: la comprobación manual de E2.3 se realizó en otro entorno; el conteo de esta base no la contradice. No se le atribuyen pasos adicionales.

### E2.3 · Prueba manual

1. Ejecutar `pnpm db:migrate`. Luego, en dos terminales, `pnpm dev` y `pnpm worker`. Si hace falta, `pnpm sources:sample-pdfs`.
2. Como responsable, abrir una fuente lista y usar **Reemplazar archivo** con otro `.md` o con `manual-con-texto.pdf`. La versión sube a 2 y se ve el contenido nuevo.
3. Reemplazar con `danado.pdf`. Debe aparecer “Reemplazo · versión 3 … Falló” con su motivo, y el contenido anterior sigue visible.
4. Pulsar **Reintentar procesamiento** hasta agotar los 3 intentos; después aparece el aviso de carga corregida. Cargar un archivo válido: pasa a ser la vigente.
5. Como integrante, abrir la misma fuente: se ve solo el contenido vigente, sin controles.

### Resultado de E2.4

Implementado y verificado automáticamente el 2026-10-01 con el alcance indicado por el usuario. Las versiones se conservan mientras exista la fuente. Solo los responsables activos eliminan, con confirmación explícita y sin papelera. La fuente desaparece al instante para ambos roles y el worker purga originales y texto de todas las versiones. Una purga fallida deja la fuente inaccesible y se reintenta. Ningún trabajo pendiente o en curso la vuelve a publicar. Quedan solo metadatos mínimos y auditoría con identificadores.

Evidencia:

- **Migración** `20261001040000_e2_4_source_deletion.sql`: acciones de auditoría de fuentes, campos de eliminación y purga, título y SHA-256 anulables tras la purga. Aplicada con `pnpm db:migrate`, sin reset; datos locales conservados.
- **`pnpm test:integration:sources`, 10/10.** Una prueba elimina una fuente con 3 versiones (reemplazada, vigente PDF y fallida) y comprueba:
  - rechazo de integrante y de usuario ajeno;
  - inaccesibilidad para ambos roles, con reemplazo y reintento en 404;
  - 3 objetos y 2 segmentos purgados;
  - metadatos sin título ni SHA-256;
  - auditoría `fuente_cargada`, `fuente_reemplazada` ×2 y `fuente_eliminada`.

  Otra prueba demuestra que un trabajo pendiente (sin worker) y uno en curso (ya iniciado) no reactivan la fuente eliminada.
- **Pruebas unitarias de la purga:** fallo de Storage transitorio sin marcar la purga como hecha.
- **`pnpm test:e2e:sources`, 6/6:** eliminación con casilla y diálogo, aviso, desaparición del listado y 404 posterior; el integrante no ve el botón.
- **Regresión:** `pnpm verify` (48 pruebas unitarias, higiene y build), `pnpm test:integration` 36/36, `pnpm test:e2e` 18/18 y `git diff --check`. Sin residuos ni trabajos pendientes.

**Confirmación manual (separada de la evidencia automática):** Comprobación manual del usuario del 2026-10-01: confirmó que la prueba manual de E2.4 funcionó correctamente y aceptó la entrega. No se le atribuyen pasos adicionales. Estado agregado de esta base local tras la confirmación: 3 fuentes activas, 0 eliminadas, 3 objetos y 0 trabajos pendientes. E2.4 queda cerrada localmente.

### E2.4 · Prueba manual

1. Ejecutar `pnpm db:migrate`. Luego, en dos terminales, `pnpm dev` y `pnpm worker`.
2. Como responsable, cargar un `.md` desechable, por ejemplo `desechable.md`, y, si se quiere, reemplazarlo una vez.
3. Abrir la fuente, marcar la casilla “Entiendo que se eliminarán…”, pulsar **Eliminar fuente** y aceptar el diálogo. Debe volver al listado con “Fuente eliminada” y la fuente ya no aparece.
4. Abrir de nuevo la URL anterior de la fuente: 404. Como integrante, tampoco aparece en el listado.

### Cierre de E2

E2 queda cerrada el 2026-10-01 para el prototipo local con documentos sintéticos.

- **RF-03/CA-02:** evidencia automática de E2.1–E2.4 (carga, procesamiento, estado listo o fallido, reintento sin duplicar, reemplazo y eliminación) y confirmaciones manuales del usuario de E2.1–E2.4. La de E2.3 se hizo en otro entorno.
- **Limitaciones explícitas:**
  - no hay OCR, papelera, historial visible de versiones, descarga de originales, limpieza por antigüedad ni panel de auditoría;
  - la retención para datos reales sigue en PEN-06;
  - el destino de futuras citas, lecciones y rutas ante reemplazo o eliminación sigue en PEN-04.
- **Archivos huérfanos (PEN-12):** si la web cae entre subir un original y confirmar su transacción, puede quedar un objeto privado sin fila. No es accesible desde el navegador. El usuario lo aceptó el 2026-10-01 como limitación conocida del prototipo local con documentos sintéticos; su limpieza debe resolverse antes de usar documentación real o desplegar. Es distinto de la purga de fuentes eliminadas, que sí está implementada.

## E3 · Asistente con evidencia (prototipo)

Estado: **cerrada para el prototipo local** el 2026-10-01 ([ADR-005](decisiones/ADR-005-asistente-e3.md)).

**Entregado:**
- consulta en el espacio autenticado para ambos roles;
- recuperación híbrida léxica y semántica (pgvector) solo de versiones vigentes;
- respuesta por un modelo configurable con citas verificadas a fuente, versión y ubicación;
- reconocimiento de falta de evidencia;
- límites por consulta.

**Pospuesto:** historial de conversaciones privadas (RN-04) y su retención; no hay persistencia de preguntas ni respuestas. **No implementado:** límites acumulados de gasto o de consultas por usuario y umbral de similitud.

- **Pruebas técnicas (simuladas):** 56 unitarias, integración 42/42 (6 del asistente), navegador 20/20 (2 del asistente), `pnpm verify` y `git diff --check`.
- **Evaluación con modelo real:** OpenAI `gpt-4.1-mini` y `text-embedding-3-small`, una ejecución de `pnpm assistant:evaluate` (detalle en el [documento 06](06-ia-y-evaluacion.md#evaluación-de-e3)). Para cerrar no se repitieron llamadas de pago.
- **Comprobación manual:** Comprobación manual del usuario del 2026-10-01: confirmó que la comprobación manual del asistente con IA real funcionó correctamente y aceptó la entrega. No se le atribuyen escenarios adicionales. Estado agregado posterior: 3 fuentes, 5 segmentos y 5 embeddings `openai:text-embedding-3-small`.
- **Limitaciones conservadas:**
  - la evaluación con modelo real fue pequeña: una ejecución, 3 documentos sintéticos y 4 casos;
  - falta una prueba directa de resistencia a instrucciones maliciosas en documentos;
  - no hay límite acumulado de gasto ni de consultas por usuario;
  - no hay umbral de similitud;
  - el modelo cita en la lista y no como marcas en el texto.

## E4.1 · Borrador de onboarding con IA

Estado: **cerrada para el prototipo local** el 2026-10-01 ([ADR-006](decisiones/ADR-006-rutas-e4-1.md)).

**Entregado:**
- objetivo y de 1 a 5 fuentes vigentes;
- generación con el modelo configurado (de 3 a 7 pasos con lección citada y pregunta de opción múltiple);
- insuficiencia reconocida;
- edición, reordenamiento y eliminación de pasos;
- publicación revalidada y estable;
- lectura para ambos roles, sin clave de respuesta para integrantes;
- avisos de citas obsoletas;
- 5 intentos por espacio y día.

**Fuera de E4.1:** ejercicios de código, adaptación, historial y versiones nuevas de rutas, respuestas, calificación y progreso (E5).

- **Pruebas técnicas:**
  - 64 unitarias;
  - `pnpm test:integration:routes` 6/6 y `pnpm test:e2e:routes` 2/2;
  - regresión: integración 48/48 y navegador 22/22;
  - `pnpm verify` y `git diff --check`.
- **Evaluación con modelo real:** 2 generaciones; objetivo cubierto → borrador correcto con citas, objetivo no cubierto → insuficiente. Detalle y consumo en el [documento 06](06-ia-y-evaluacion.md#evaluación-de-e41-generación-de-rutas).
- **Protección añadida antes del cierre:** separación de trabajos de prueba por namespace. `pnpm test:integration:isolation` 3/3 (un worker de otro namespace hizo 0 llamadas a su modelo y a su embedder falsos); integración 51/51; `pnpm verify` (64 unitarias); navegador afectado en modo simulado: fuentes 6/6, rutas 2/2 y asistente 2/2, sin trabajos en colas normales.
- **Comprobación manual:** Comprobación manual del usuario del 2026-10-01: confirmó que la comprobación manual de E4.1 funcionó correctamente y aceptó la entrega. No se le atribuyen escenarios adicionales. Estado agregado posterior de su espacio: 3 rutas (1 lista y 2 con evidencia insuficiente) y 4 intentos de generación registrados.

**Incidente del 2026-10-01 (cerrado con la protección de §22 del documento 04):**

- **Hechos comprobados:**
  - durante una regresión ejecutada por el asistente de desarrollo, seguían en marcha el `pnpm dev` y el `pnpm worker` del usuario, en modo real;
  - el worker había arrancado a las 15:48, hora local, antes de la protección;
  - las pruebas de navegador reutilizaron ese servidor, que encoló en las colas normales 1 trabajo de generación, 9 de procesamiento y 1 de purga de datos de prueba;
  - el worker del usuario los completó; el de generación duró 1,28 s.
- **Estimado, no comprobado:**
  - probablemente 1 llamada corta a `gpt-4.1-mini`, por una duración similar a las generaciones manuales con llamada real que acabaron en insuficiente;
  - y hasta unas 5 solicitudes de embeddings de textos sintéticos breves.

  No se calculó un importe; los datos de prueba se eliminaron y la base no conserva sus intentos. El registro del worker del usuario puede confirmarlo (`route_generation`, `segment_embeddings_saved` hacia las 15:58).
- **Causa:** pruebas y worker real compartían colas, sin separación por entorno, y Playwright reutilizaba un servidor ya arrancado. Además, se lanzó la regresión sin detenerse al detectar esos procesos.

### E4.1 · Prueba manual

1. Reiniciar `pnpm dev` y `pnpm worker`.
2. Como responsable: **Rutas** → escribir un objetivo cubierto por tus fuentes sintéticas, marcar 1 o 2 fuentes y pulsar **Generar borrador**. Esperar “Borrador listo”. Cada generación cuenta en el límite diario de 5.
3. Editar un paso (texto o respuesta correcta), moverlo o eliminarlo, y pulsar **Publicar ruta**.
4. Como integrante: abrir la ruta publicada y comprobar que no ve borradores ni respuestas correctas, y que puede abrir las citas.
5. Opcional: reemplazar una fuente citada y comprobar el aviso “Revisar”.

## E5.1 · Recorrido de una ruta publicada

Estado: **cerrada para el prototipo local** el 2026-10-01 ([ADR-007](decisiones/ADR-007-recorrido-e5-1.md)).

**Entregado:** empezar una ruta publicada, responder con corrección en el servidor, retroalimentación, hasta 3 intentos, respuesta correcta y explicación al resolver, avance secuencial, progreso retomable y privado, protección contra doble envío y resultado con pasos resueltos y acertados.

**Fuera de E5.1:** progreso del equipo, reinicio de rutas, ejercicios de código y gamificación.

- **Pruebas técnicas:**
  - 67 unitarias, 3 de ellas de reglas;
  - `pnpm test:integration:learning` 4/4: inicio, clave oculta, orden, doble envío simultáneo con un solo intento, agotamiento, resultado por pasos acertados, persistencia, “Revisar” continuable y aislamiento con membresía revocada;
  - `pnpm test:e2e:learning` 2/2;
  - regresión: integración 55/55 y navegador 24/24;
  - `pnpm verify` y `git diff --check`.
- **Evaluación con modelo real:** no aplica, porque E5.1 no hace llamadas de IA.
- **Comprobación manual:** Comprobación manual del usuario del 2026-10-01: confirmó que realizó las pruebas manuales de E5.1 y funcionaron correctamente, y aceptó la entrega. No se le atribuyen comprobaciones adicionales. Estado agregado posterior: 1 ruta publicada, 1 progreso completado y 4 intentos. Se reutilizó la verificación técnica: después solo cambió documentación.

### E5.1 · Prueba manual

1. `pnpm dev` (no hace falta `pnpm worker`).
2. Como integrante: abrir una ruta publicada → **Recorrer ruta** → **Empezar ruta**.
3. Responder mal una vez: debe decir cuántos intentos quedan, sin mostrar la respuesta. Luego acertar: aparecen la respuesta correcta y la explicación.
4. Salir y volver: el progreso se conserva.
5. Agotar los 3 intentos en un paso: se revela la respuesta y se desbloquea el siguiente.
6. Al terminar: “Ruta completada”, con pasos resueltos y acertados por separado. Con el responsable, comprobar que su progreso es independiente.
