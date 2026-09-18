# Estado actual y reanudación

Actualizado: 2026-09-18 · Fase: E1.3 cerrada y comprobada localmente; E1.4 no iniciada · Versión documental: 0.8.

## Hechos acordados

- Producto propio para validar y portafolio, desarrollado individualmente con Codex.
- Onboarding interactivo y consultas permanentes como usos centrales; V0 enfocada en equipos de software.
- Arquitectura modular, web/API juntas, worker desde E2 y stack local aceptados.
- Identidad E1.2 aceptada solo en local: correo/contraseña, sesión, recuperación por Mailpit, validación en servidor y ausencia de registro público.
- E1.3 acepta usuarios en varios espacios, membresía única por usuario/espacio, roles `responsable`/`integrante`, responsables múltiples y bootstrap privado por operador sobre una identidad existente.

## Actualización más reciente

Implementada E1.3 sobre el commit base `c5f021f6e85a8b5ff94a9d8d035961a1bc86916d`. Una migración incremental añadió perfiles, espacios y membresías sin perder la identidad Auth existente. El comando privado crea el primer responsable de forma atómica e idempotente y las vistas `/spaces` filtran por la membresía de la identidad validada. El usuario confirmó el 2026-09-18 que realizó la comprobación manual de E1.3 y funcionó correctamente.

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
- Añadido `pnpm env:sync`; `env:start` mantiene `.env.local` ignorado sincronizado sin imprimir secretos.

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

## No realizado

No se implementaron invitaciones, alta/retirada/cambio de rol de miembros, matriz completa de autorización, documentos, rutas, IA, E2, despliegue ni proveedor externo. La parte restante de RN-08/RN-11 y RN-13–RN-18 continúa pendiente según cada entrega.

## Próxima tarea concreta

Revisar y resolver solamente las decisiones de matriz y revocación que bloquean E1.4; después, solicitar autorización expresa antes de implementarla. No adelantar invitaciones de E1.5, administración de E1.6, piloto o proveedores.

## Estado de Git y operación

E1.3 se consolida en el commit local `feat(access): implement spaces memberships and local bootstrap`, sin remoto ni push. La migración local está aplicada y Supabase conserva sus datos; `.env.local`, secretos temporales, dependencias, build y resultados de prueba permanecen ignorados.

## Formato para futuras sesiones

Fecha; tarea realizada; archivos afectados; decisiones y fundamento; verificaciones realmente ejecutadas; bloqueos; siguiente paso. Enlazar especificaciones e historial sin duplicar reglas.
