# Entregas y aceptación

Estado: secuencia inicial de planificación; sin fechas comprometidas.
Actualizado: 2026-10-01.

## Etapa actual: E1 cerrada localmente

Arquitectura modular, stack y ciclo local de acceso están aceptados en ADR-003. E1.1–E1.6 cuentan con evidencia automatizada y confirmaciones manuales del usuario. E1.7 fue revisada y aceptada por el usuario el 2026-10-01, con evidencia automatizada y una comprobación manual delimitada; E1 queda cerrada localmente. E2 requiere autorización separada. Piloto y proveedores permanecen fuera del alcance.

| Entrega | Requisitos | Evidencia propuesta de cierre |
| --- | --- | --- |
| E1 Base y acceso | RF-01, RF-02 | CA-01: dos roles acceden a su espacio; accesos no autorizados rechazados, incluida manipulación de identificadores |
| E2 Fuentes | RF-03 | CA-02: archivo permitido llega a listo, error se ve y se puede reintentar sin duplicar resultados |
| E3 Asistente | RF-08 | CA-03: preguntas de referencia producen evidencia resoluble; preguntas sin respaldo reconocen insuficiencia; chats aislados |
| E4 Autoría | RF-04, RF-05 | CA-04: borrador editable, publicación solo por responsable y versión publicada estable |
| E5 Aprendizaje | RF-06, RF-07, RF-09 | CA-05: actividad evaluada con criterios revisados, progreso retomable y seguimiento autorizado |
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
