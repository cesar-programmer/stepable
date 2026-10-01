# ADR-003 · Stack y política mínima de acceso para E1

Fecha: 2026-10-01 · Estado: aceptado para el ciclo local de E1; endurecimiento externo de RN-18, proveedores y piloto pendientes.

## Contexto

E1 debe entregar cuentas, espacios, membresías y permisos. Stepable lo desarrolla una persona con Codex y dispone de aproximadamente 10 USD mensuales para primeras pruebas. ADR-002 define módulos lógicos, API y worker compartiendo reglas. Al iniciar esta decisión no había código ni Git; E1.1 ya creó y verificó la base local.

## Resolución parcial del 2026-09-17

El usuario aceptó para desarrollo local los puntos 1, 2 y 7: arquitectura modular, web/API juntas, worker desde E2, stack TypeScript/Next.js/`pnpm`/Zod/PostgreSQL/Drizzle/Vitest/Playwright y una sola pila Supabase CLI para PostgreSQL/Auth/Mailpit. No aprobó en bloque RN-08–RN-18, proveedores alojados, correo externo, dominios, costos o despliegue.

## Resolución parcial de E1.2 del 2026-09-17

El usuario aceptó la porción local de RN-08: autenticación por correo y contraseña mediante Supabase Auth local, login/logout, recuperación y establecimiento de contraseña desde Mailpit, sesión persistida y validación de identidad en servidor. No hay registro público; un procedimiento operativo interactivo crea usuarios de prueba confirmados sin credenciales fijas o versionadas. Esta resolución no crea un administrador de Stepable ni acepta espacios, membresías, roles, invitaciones, RN-09–RN-18 o la parte de invitación de RN-08.

## Resolución parcial de E1.3 del 2026-09-17

El usuario aceptó RN-09, RN-10 y el principio de RN-12 para desarrollo local: una identidad puede pertenecer a varios espacios, existe una membresía única por usuario/espacio y los roles `responsable`/`integrante` pertenecen al espacio. El bootstrap es un comando privado del operador que vincula una identidad Auth existente como primer responsable; no crea identidades, contraseñas o invitaciones. Los espacios admiten varios responsables y no deben quedar sin ninguno, pero la administración y sus carreras se implementan en E1.6. También se acepta aplicar desde E1.3 la comprobación de membresía de RN-11 al listado y detalle de espacios; la autorización completa permanece en E1.4.

## Resolución parcial de E1.4 del 2026-09-18

El usuario aceptó completar RN-11 y la semántica local de RN-17: toda solicitud protegida valida identidad en servidor y consulta la membresía, estado y rol vigentes en PostgreSQL, sin roles del token ni caché de permisos. La matriz cerrada permite a ambos roles activos consultar el espacio y reserva gestión de invitaciones/miembros al responsable activo; ausencia, revocación, rol o acción desconocidos se deniegan. La membresía revocada se conserva bajo la misma unicidad usuario/espacio, no cierra la sesión global ni afecta otros espacios. Reincorporación, endpoints y operaciones concurrentes quedan en E1.5/E1.6.

## Resolución parcial de E1.5 del 2026-09-18

El usuario aceptó invitaciones locales de siete días, rol `integrante` predeterminado y `responsable` solo por selección explícita; el establecimiento de una identidad nueva mediante Auth/Mailpit separado de la aceptación Stepable; reactivación de membresías revocadas con el rol invitado; y prohibición de cambiar mediante invitación el rol de una membresía activa. También autorizó crear, listar, reenviar, cancelar y aceptar con token aleatorio de un uso cuyo hash es lo único persistido, autorización central, correo verificado coincidente y transacción atómica. La administración general de miembros permanece en E1.6 y RN-18 no se acepta en bloque.

## Resolución parcial de E1.6 del 2026-09-19

El usuario aceptó completar la administración local de RN-12/RN-16/RN-17. Un responsable activo puede cambiar el rol o retirar a otro miembro, incluido otro responsable, y puede degradarse o retirarse a sí mismo si permanece al menos un responsable activo. Un integrante activo solo puede abandonar su propia membresía. El listado administrativo incluye activas y revocadas; las revocadas no admiten reactivación directa ni cambio de rol y solo regresan mediante una nueva invitación. Las operaciones concurrentes deben revalidar actor e invariante dentro de la transacción.

## Resolución parcial de E1.7 del 2026-09-21

El usuario autorizó el cierre técnico exclusivamente local: auditoría mínima de mutaciones de acceso, revisión de autorización/errores/logs/secretos, operación reproducible y evidencia de RF-01/RF-02/CA-01. La implementación usa una tabla append-only para la aplicación con acciones y tipos cerrados, identificadores de actor/espacio/objetivo y fecha; no duplica correos ni admite cargas libres. El evento se escribe en la misma transacción que la mutación exitosa. Esta decisión no aprueba retención para datos reales, paneles, proveedores, despliegue o E2.

## Cierre local de E1 del 2026-10-01

El usuario revisó E1.7, realizó la comprobación manual y la aceptó. E1 queda cerrada para desarrollo local. Esta aceptación no aprueba E2, proveedores, despliegue, costos ni retención de datos reales.

## Propuesta

1. Mantener el monolito modular de ADR-002. Web/API comparten despliegue en E1; el worker es un ejecutable del mismo código y se activa en E2, no un microservicio por módulo.
2. Usar TypeScript estricto, Node.js LTS, `pnpm`, Next.js App Router, Zod, PostgreSQL, Drizzle, Vitest y Playwright.
3. Propuesta pendiente: usar adaptadores para identidad, archivos, correo, trabajos e IA. Jobs, búsqueda, servicios alojados y proveedores se resolverán en sus entregas o antes del piloto.
4. Aceptados: porción local de RN-08 en E1.2; RN-09, RN-10 y principio de RN-12 en E1.3; RN-11, matriz mínima y semántica de revocación de RN-17 en E1.4; invitaciones de RN-13–RN-15 y parte de RN-16 en E1.5; administración de RN-12/RN-16–RN-17 en E1.6; auditoría y cierre técnico local en E1.7. Pendiente: endurecimiento externo de RN-18.
5. Aprovisionar el primer espacio y los posteriores mediante un comando operativo privado que exige una identidad local existente. Crea perfil, espacio y primera membresía en una transacción idempotente; no crea invitación ni contraseña y no existe endpoint público. Durante la V0 los responsables no crean otros espacios.
6. Aceptado en E1.4: revocación por commit; cada caso de uso consulta membresía/rol vigente en PostgreSQL, no roles de tokens o cachés. Retirar un espacio no cierra la sesión global; las solicitudes ya admitidas siguen las reglas de bloqueo descritas en el documento 05.
7. Desarrollar localmente con una única pila Supabase CLI para PostgreSQL, Auth y Mailpit; no duplicar base ni SMTP local. Contratar o desplegar solo con autorización separada.
8. Piloto pendiente: correo externo, dominios, alojamiento y costos no tienen proveedor aprobado.

## Alternativas consideradas

- Microservicios o backend separado desde E1: más despliegues, contratos y costo operativo sin una carga que lo justifique.
- Todo en componentes/acciones de la interfaz: menos estructura inicial, pero favorece autorización dispersa y dificulta reutilizar reglas en el worker.
- Autenticación propia: da control, pero añade manejo sensible de contraseñas, verificación y recuperación sin aportar diferenciación al producto.
- Base vectorial y Redis/cola independientes: capacidades innecesarias para E1 y más costo. PostgreSQL cubre el piloto y permite revisar esta decisión con evidencia.
- Un plan administrado de pago como base del piloto: puede reducir carga operativa, pero proveedor, precio, límites y suficiencia presupuestaria deberán compararse de nuevo antes de autorizar el piloto.

## Consecuencias

- El mismo lenguaje y un solo despliegue inicial reducen carga para un desarrollador; se exige mantener límites de módulos mediante dependencias y pruebas.
- Supabase acelera identidad y persistencia, pero crea dependencia operativa. Los datos de negocio usan PostgreSQL estándar y los proveedores quedan detrás de adaptadores para limitarla.
- La base local no decide disponibilidad, backups, correo o costos del piloto; deberán resolverse antes de usar datos reales.
- La invitación y membresía pertenecen a Stepable, no a los metadatos de Auth; el proveedor autentica identidad, no autoriza espacios.
- La operación de aprovisionamiento tiene credenciales elevadas, pero no crea un rol global dentro del producto. Sus secretos viven en el entorno/gestor de secretos y sus acciones se auditan.
- La autorización por solicitud prioriza corrección sobre una caché prematura. Una revocación no recupera respuestas ya enviadas ni cancela automáticamente una operación que confirmó antes.
- El bootstrap usa `slug` como clave idempotente y bloqueo asesor por transacción. Repeticiones idénticas convergen en un espacio/membresía activa; parámetros incompatibles, rol cambiado o membresía revocada se rechazan sin reactivar ni modificar datos.
- Listar o abrir un espacio consulta siempre `memberships` con el UUID de la identidad validada y exige estado activo. Conocer o alterar un UUID de espacio no basta para leerlo; una política central aplica la matriz y deniega valores desconocidos.
- Cambiar rol, retirar o abandonar toma un bloqueo transaccional por espacio y vuelve a comprobar actor, objetivo e invariante después de adquirirlo. Dos responsables concurrentes no pueden usar permisos mutuamente obsoletos ni dejar el espacio sin responsable activo.
- Crear, reenviar o cancelar una invitación toma el mismo bloqueo transaccional y vuelve a comprobar al actor. Así, perder el rol o la membresía mientras la operación espera impide que la mutación y su auditoría confirmen.
- La auditoría conserva solo identificadores, acción y fecha. El bootstrap se atribuye a un actor `operador` sin inventar una identidad global del producto; las demás mutaciones usan el UUID del perfil autenticado. La retención sigue en PEN-06 antes de datos reales.
- Las tablas de negocio no se consultan directamente con los roles Data API `anon`/`authenticated`: sus privilegios están revocados y RLS permanece habilitada. La conexión servidor ejecuta los casos de uso y la política central.
- Supabase CLI es la única base/Auth local y captura correo con Mailpit; `supabase/migrations` es el historial SQL canónico. Drizzle se usa para acceso tipado, no como segundo historial de migraciones.
- Las versiones locales quedaron fijadas en `package.json`/`pnpm-lock.yaml` y verificadas en E1.1. No se contrata ningún proveedor mediante este ADR.

## Implementación local verificada

E1.1 fijó Node 24, pnpm 11.23.0, Next.js 16.3.5, React 19.3.0, TypeScript 5.9.3, Zod 4.6.5, Drizzle 0.45.2, Vitest 5.0.1, Playwright 1.63.0 y Supabase CLI 2.117.0. La pila instalada usa PostgreSQL 17.6.1, GoTrue 2.196.0 y Mailpit 1.30.2. La versión instalada se verificó directamente; no se asume que versiones futuras conserven los mismos componentes.

E1.2 añadió `@supabase/ssr` 0.12.7 y `@supabase/supabase-js` 2.116.0 detrás de un adaptador de identidad. `auth.enable_signup = false` bloquea el alta pública; el proveedor de correo permanece habilitado para login y recuperación. La página protegida usa `getUser()` en servidor, el proxy renueva cookies y Mailpit entrega un enlace con token hash de un solo uso. Las pruebas administrativas obtienen la clave efímeramente de Supabase CLI/estado local y comprobaron que no aparece en HTML o JavaScript del navegador.

E1.3 añadió una migración incremental para perfiles, espacios y membresías, un adaptador PostgreSQL/Drizzle, comando privado y vistas de lista/detalle. La migración se aplicó sin `db reset` y conservó la identidad local existente. Una restricción diferida exige al menos un responsable al confirmar; E1.6 completó el bloqueo de operaciones administrativas concurrentes.

E1.4 añadió `membership_status` (`activa`/`revocada`) conservando filas existentes como activas, una política central con tres acciones explícitas y casos de uso que consultan PostgreSQL en cada solicitud. La restricción del último responsable cuenta solo membresías activas y el bootstrap informa conflicto ante una membresía inicial revocada o con rol incompatible. Integración y navegador comprobaron revocación con sesión viva, cambio de rol, aislamiento, 404 y acceso conservado a otro espacio, sin `db reset` ni cambios al espacio manual.

E1.5 añadió la tabla `invitations`, casos de uso y adaptadores de PostgreSQL, Mailpit y Auth administrativo. El token Stepable se coloca en el fragmento del enlace, se retira del navegador al cargar y solo su hash queda en PostgreSQL. Reenvío rota el token; aceptación, cancelación y reenvío bloquean la invitación para resolver carreras. La aceptación y la membresía comparten transacción; cuenta nueva y aceptación permanecen separadas. La clave de servicio vive solo en el entorno servidor ignorado y conserva un nombre sin prefijo `NEXT_PUBLIC_`.

E1.6 añadió una acción central `abandonar_espacio`, un adaptador de membresías y una interfaz mínima. El listado administrativo está reservado a responsables activos y muestra activas/revocadas sin exponer otros espacios. Cambio de rol, retiro y autosalida se serializan mediante bloqueo asesor por espacio, revalidan permisos actuales y respetan la restricción diferida del último responsable. No fue necesaria una migración nueva ni se añadió reactivación fuera de invitaciones.

E1.7 añadió `access_audit_events` y registró dentro de las transacciones exitosas la creación de espacio, creación/reenvío/cancelación/aceptación de invitación, cambio de rol, retiro y autosalida. La revisión corrigió la revalidación concurrente de las mutaciones de invitación, cerró la Data API directa sobre las tablas E1, amplió la comprobación de credenciales en recursos del navegador y agregó higiene reproducible del repositorio. Las migraciones fueron incrementales y no reiniciaron la base.

Correo externo, dominios, alojamiento, proveedores y costos quedan como investigación histórica no aprobada y deben reabrirse antes del piloto.

## Condiciones para aceptar

E1.1–E1.6 cuentan con verificación automática y confirmaciones manuales. E1.7 cuenta con verificación automática y la comprobación manual del 2026-10-01; E1 está aceptada localmente. El piloto reabrirá RN-18, correo externo, dominios, alojamiento, costos, backup y retención. E1.7 no autoriza contratación, despliegue o E2.
