# ADR-003 · Stack y política mínima de acceso para E1

Fecha: 2026-09-17 · Estado: resolución parcial; stack, entorno e identidad local aceptados; espacios, invitaciones y piloto propuestos.

## Contexto

E1 debe entregar cuentas, espacios, membresías y permisos. Stepable lo desarrolla una persona con Codex y dispone de aproximadamente 10 USD mensuales para primeras pruebas. ADR-002 define módulos lógicos, API y worker compartiendo reglas. Al iniciar esta decisión no había código ni Git; E1.1 ya creó y verificó la base local.

## Resolución parcial del 2026-09-17

El usuario aceptó para desarrollo local los puntos 1, 2 y 7: arquitectura modular, web/API juntas, worker desde E2, stack TypeScript/Next.js/`pnpm`/Zod/PostgreSQL/Drizzle/Vitest/Playwright y una sola pila Supabase CLI para PostgreSQL/Auth/Mailpit. No aprobó en bloque RN-08–RN-18, proveedores alojados, correo externo, dominios, costos o despliegue.

## Resolución parcial de E1.2 del 2026-09-17

El usuario aceptó la porción local de RN-08: autenticación por correo y contraseña mediante Supabase Auth local, login/logout, recuperación y establecimiento de contraseña desde Mailpit, sesión persistida y validación de identidad en servidor. No hay registro público; un procedimiento operativo interactivo crea usuarios de prueba confirmados sin credenciales fijas o versionadas. Esta resolución no crea un administrador de Stepable ni acepta espacios, membresías, roles, invitaciones, RN-09–RN-18 o la parte de invitación de RN-08.

## Propuesta

1. Mantener el monolito modular de ADR-002. Web/API comparten despliegue en E1; el worker es un ejecutable del mismo código y se activa en E2, no un microservicio por módulo.
2. Usar TypeScript estricto, Node.js LTS, `pnpm`, Next.js App Router, Zod, PostgreSQL, Drizzle, Vitest y Playwright.
3. Propuesta pendiente: usar adaptadores para identidad, archivos, correo, trabajos e IA. Jobs, búsqueda, servicios alojados y proveedores se resolverán en sus entregas o antes del piloto.
4. Aceptado solo para E1.2: la porción local de identidad de RN-08. Propuesta pendiente: completar RN-08 y adoptar RN-09–RN-18 de [datos y permisos](../05-datos-y-permisos.md) para acceso por espacio, roles e invitaciones.
5. Aprovisionar el primer espacio y los posteriores mediante un comando operativo privado: crea una invitación, el destinatario establece su contraseña y la aceptación crea atómicamente espacio/membresía. No existe contraseña predeterminada ni endpoint público; durante la V0 los responsables no crean otros espacios.
6. Definir revocación por commit: cada caso de uso consulta membresía/rol vigente en PostgreSQL, no roles de tokens o cachés. Retirar un espacio no cierra la sesión global; las solicitudes ya admitidas siguen las reglas de bloqueo descritas en el documento 05.
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
- Supabase CLI es la única base/Auth local y captura correo con Mailpit; `supabase/migrations` es el historial SQL canónico. Drizzle se usa para acceso tipado, no como segundo historial de migraciones.
- Las versiones locales quedaron fijadas en `package.json`/`pnpm-lock.yaml` y verificadas en E1.1. No se contrata ningún proveedor mediante este ADR.

## Implementación local verificada

E1.1 fijó Node 24, pnpm 11.23.0, Next.js 16.3.5, React 19.3.0, TypeScript 5.9.3, Zod 4.6.5, Drizzle 0.45.2, Vitest 5.0.1, Playwright 1.63.0 y Supabase CLI 2.117.0. La pila instalada usa PostgreSQL 17.6.1, GoTrue 2.196.0 y Mailpit 1.30.2. La versión instalada se verificó directamente; no se asume que versiones futuras conserven los mismos componentes.

E1.2 añadió `@supabase/ssr` 0.12.7 y `@supabase/supabase-js` 2.116.0 detrás de un adaptador de identidad. `auth.enable_signup = false` bloquea el alta pública; el proveedor de correo permanece habilitado para login y recuperación. La página protegida usa `getUser()` en servidor, el proxy renueva cookies y Mailpit entrega un enlace con token hash de un solo uso. Las pruebas administrativas obtienen la clave efímeramente de Supabase CLI/estado local y comprobaron que no aparece en HTML o JavaScript del navegador.

Correo externo, dominios, alojamiento, proveedores y costos quedan como investigación histórica no aprobada y deben reabrirse antes del piloto.

## Condiciones para aceptar

Queda pendiente completar RN-08 y aprobar o ajustar RN-09–RN-18, bootstrap, revocación y matriz de permisos antes de implementar espacios, membresías, roles o invitaciones. El piloto reabrirá correo externo, dominios, alojamiento, costos, backup y retención. La resolución parcial no autoriza E1.3 ni contratación.
