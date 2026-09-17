# Estado actual y reanudación

Actualizado: 2026-09-17 · Fase: E1.1 cerrada y comprobada por el usuario · Versión documental: 0.6.

## Hechos acordados

- Producto propio para validar y portafolio, desarrollado individualmente con Codex.
- Onboarding interactivo y consultas permanentes como usos centrales.
- Visión amplia y enfoque inicial en software.
- V0 aceptada como base de planificación; documentación separada para mantener continuidad.

## Actualización más reciente

El usuario comprobó manualmente que la página de Stepable responde HTTP 200 y que Supabase inicia. La revisión posterior de los enlaces efectivos de Docker confirmó que los puertos publicados están limitados a `127.0.0.1`; el aviso `All services bind to 0.0.0.0` de Supabase CLI es genérico bajo la red configurada. E1.1 queda cerrada sin autorizar E1.2.

## Realizado

- Desarrollado [04-arquitectura](04-arquitectura.md): componentes, módulos, dependencias, flujos de ingesta/chat/publicación/aprendizaje, almacenamiento, fallos y controles de acceso.
- Aceptado [ADR-002](decisiones/ADR-002-organizacion-modular.md): backend modular, web/API juntas y worker desde E2.
- Aceptados parcialmente stack y entorno local de [ADR-003](decisiones/ADR-003-stack-y-acceso-e1.md).
- Inicializado Git en rama `main`; primer commit local creado sin remoto ni push.
- Creada aplicación Next.js mínima y configuración de TypeScript, Zod, Drizzle, Vitest, Playwright, ESLint y Prettier.
- Supabase CLI 2.117.0 inicializada con PostgreSQL/Auth/Mailpit; puertos publicados solo en `127.0.0.1` mediante red `stepable-local`.
- Añadidos migración y seed base sin tablas o datos de producto; `.env.example` no contiene secretos y `.env.local` está ignorado.

## Evidencia y estado real del repositorio

- Dependencias exactas y lockfile instalados; `pnpm peers check` sin problemas.
- `pnpm verify`: formato, lint, tipos, 2 pruebas unitarias y build aprobados.
- `pnpm test:e2e`: 1 smoke test aprobado en Chromium.
- `pnpm db:reset`: migración y seed aplicados en la red `stepable-local`; finalizó saludable.
- PostgreSQL aceptó conexiones; Auth respondió como GoTrue 2.196.0; Mailpit respondió como 1.30.2; aplicación respondió HTTP 200.
- Se verificaron componentes de los contenedores instalados, incluido PostgreSQL 17.6.1. Los extras de Supabase están presentes pero no forman parte funcional de E1.1.
- El usuario confirmó manualmente el arranque web con HTTP 200 y el inicio de Supabase.
- `docker inspect` confirmó los enlaces efectivos `127.0.0.1:54321`, `:54322`, `:54323`, `:54324` y `:54327`. Los demás puertos de los contenedores no están publicados al host. La red `stepable-local` tiene `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`; no se encontró publicación en `0.0.0.0` ni `::`.

## No realizado

No se aprobaron ni implementaron RN-08–RN-18, cuentas, login, bootstrap, espacios, membresías, roles, invitaciones, autorización o correo de aplicación. No hay E2, despliegue, proveedor contratado, repositorio remoto, fecha/volumen/participantes de piloto ni estimación de costo vigente.

## Próxima tarea concreta

Revisar y aprobar las reglas necesarias antes de autorizar E1.2; no avanzar automáticamente a identidad o permisos.

## Verificación de esta entrega

Verificaciones reales descritas arriba. Se comprobaron enlaces Markdown locales, estados de los ADR, archivos preparados para el primer commit y ausencia de secretos o artefactos generados versionados. No se consultaron ni alteraron los PDF. No se ejecutó `db reset`, no se eliminaron volúmenes y los datos locales se conservaron.

## Formato para futuras sesiones

Fecha; tarea realizada; archivos afectados; decisiones y fundamento; verificaciones realmente ejecutadas; bloqueos; siguiente paso. Enlazar especificaciones e historial sin duplicar reglas.
