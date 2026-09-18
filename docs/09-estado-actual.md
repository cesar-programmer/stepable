# Estado actual y reanudación

Actualizado: 2026-09-17 · Fase: E1.2 cerrada y comprobada localmente; E1.3 no iniciada · Versión documental: 0.7.

## Hechos acordados

- Producto propio para validar y portafolio, desarrollado individualmente con Codex.
- Onboarding interactivo y consultas permanentes como usos centrales; V0 enfocada en equipos de software.
- Arquitectura modular, web/API juntas, worker desde E2 y stack local aceptados.
- Identidad E1.2 aceptada solo en local: correo/contraseña, sesión, recuperación por Mailpit, validación en servidor y ausencia de registro público.

## Actualización más reciente

Implementada E1.2 sobre el commit base `8e7859f5c0a65bfddfc851a1e1d2796cf035dbed`. El usuario comprobó manualmente credenciales incorrectas/correctas, acceso protegido, persistencia al recargar, logout, recuperación desde Mailpit, cambio de contraseña, rechazo de la contraseña anterior, aceptación de la nueva y rechazo del enlace ya utilizado. E1.2 queda cerrada sin autorizar E1.3.

## Realizado

- E1.1 cerrada y comprobada por el usuario: base Next.js, Supabase CLI y puertos limitados a `127.0.0.1`.
- Añadidos `@supabase/ssr` 0.12.7 y `@supabase/supabase-js` 2.116.0 con versiones bloqueadas.
- Bloqueado el registro público mediante `auth.enable_signup = false`; proveedor de correo habilitado para login y recuperación.
- Implementados adaptador de identidad, cookies SSR, renovación en `proxy.ts`, acciones de sesión y validación servidor con `getUser()`.
- Implementados `/login`, `/recover`, `/auth/callback`, `/auth/update-password` y `/protected`.
- Añadida plantilla local de recuperación capturada por Mailpit y rechazo uniforme de enlaces inválidos o consumidos.
- Añadido `pnpm auth:create-local-user`: entrada interactiva, contraseña no visible y creación confirmada solo en Auth local.
- Añadidos arnés de integración real y E2E con identidades aleatorias eliminadas al terminar; no se reinicia la base.

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

## No realizado

No se implementaron perfiles de producto, espacios, membresías, roles, bootstrap, invitaciones de Stepable, autorización por espacio, E2, despliegue ni proveedor externo. RN-08 está aceptada solo en su porción local de identidad; RN-09–RN-18 y el mecanismo de invitación continúan propuestos.

## Próxima tarea concreta

Revisar y resolver solamente las decisiones de modelo y bootstrap que bloquean E1.3; después, solicitar autorización expresa antes de implementarla. No adelantar autorización completa, invitaciones de E1.5, piloto o proveedores.

## Estado de Git y operación

E1.2 se consolida en el commit local `feat(auth): implement local identity and session flows`, sin remoto ni push. Los datos locales se conservaron. `.env.local`, secretos temporales, dependencias, build y resultados de prueba permanecen ignorados.

## Formato para futuras sesiones

Fecha; tarea realizada; archivos afectados; decisiones y fundamento; verificaciones realmente ejecutadas; bloqueos; siguiente paso. Enlazar especificaciones e historial sin duplicar reglas.
