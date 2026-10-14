# Desarrollo local

Cómo instalar, ejecutar y probar Stepable en una máquina local. El [README](../README.md) solo resume el arranque rápido.

## Requisitos

- Node.js 24 y pnpm 11 (vía Corepack). Las versiones de las dependencias están fijadas en `pnpm-lock.yaml`.
- Docker o un runtime compatible, para la pila local de Supabase.
- [Supabase CLI](https://supabase.com/docs/guides/cli).

## Primer arranque

```bash
pnpm install --frozen-lockfile
pnpm env:start      # levanta PostgreSQL, Auth, Storage y Mailpit, y genera .env.local
pnpm db:migrate     # aplica las migraciones pendientes (no borra datos)

pnpm dev            # terminal 1: aplicación en http://127.0.0.1:3000
pnpm worker         # terminal 2: procesamiento de fuentes y generación de rutas
```

| Servicio | Dirección |
| --- | --- |
| Aplicación | `http://127.0.0.1:3000` |
| Supabase Studio | `http://127.0.0.1:54323` |
| Mailpit (correos de invitación y recuperación) | `http://127.0.0.1:54324` |

`env:start` crea o reutiliza la red Docker `stepable-local` y publica los puertos solo en `127.0.0.1`. Supabase CLI puede mostrar el aviso genérico `All services bind to 0.0.0.0`; la comprobación válida es `docker inspect`, que debe mostrar `127.0.0.1` en los puertos publicados.

`.env.local` lo genera `env:start` y Git lo ignora. Supabase CLI puede mostrar claves locales en la terminal: no hay que copiarlas en informes ni compartirlas.

## Usuarios y espacios

No hay registro público.

```bash
pnpm auth:create-local-user    # pide correo y contraseña; no la muestra ni la guarda
pnpm access:bootstrap-space    # crea un espacio con una identidad existente como responsable
```

- `auth:create-local-user` crea solo una identidad confirmada en Supabase Auth local; no crea espacios ni roles.
- `access:bootstrap-space` crea en una transacción el perfil, el espacio y la primera membresía `responsable`. Repetirlo con los mismos datos no duplica nada.
- El resto del equipo se incorpora con invitaciones desde la aplicación; los correos llegan a Mailpit.
- Hay una fuente sintética de ejemplo en `samples/demo/`, y `pnpm sources:sample-pdfs` genera PDF de prueba en la carpeta temporal del sistema.

## Configuración de IA

Sin configuración, el asistente funciona en modo desactivado y muestra solo los fragmentos encontrados.

1. Copia las variables comentadas de `.env.example` en **`.env.development.local`**. Git lo ignora y `env:start` no lo sobrescribe.
2. Elige el modo (`desactivado`, `simulado` o `real`), el proveedor, el modelo y la clave de API. Nunca en el código ni en archivos versionados.
3. Reinicia `pnpm dev` y `pnpm worker`.

Los límites de consumo estimado (`STEPABLE_AI_BUDGET_*`, `STEPABLE_AI_USER_DAILY_QUERIES`) también están en `.env.example`. Las reglas están en [RN-39](03-flujos-y-reglas.md).

`pnpm assistant:evaluate`, `pnpm routes:evaluate` y `pnpm help:evaluate` hacen **llamadas reales** al proveedor; solo deben ejecutarse de forma consciente.

## Pruebas

```bash
pnpm verify             # formato, lint, tipos, unitarias, revisión de secretos y build
pnpm test:integration   # contra Auth, PostgreSQL y Mailpit locales reales
pnpm test:e2e           # recorridos en el navegador (requiere Chromium de Playwright)
pnpm security:check     # archivos versionables, secretos y correos fuera de dominios reservados
```

- Las pruebas fuerzan el modo de IA `simulado` y el namespace de trabajos `pruebas`: nunca llaman a un proveedor de pago ni comparten trabajos con un `pnpm worker` en marcha.
- Crean identidades y espacios desechables y los eliminan al terminar.
- Las pruebas de navegador arrancan su propio servidor. Si el puerto 3000 está ocupado por `pnpm dev`, fallan sin enviar nada: hay que detenerlo antes.
- Hay comandos por área (`test:e2e:routes`, `test:e2e:assistant`, `test:integration:sources`…); la lista completa está en `package.json`.

Las pruebas manuales de cada entrega están en [entregas y aceptación](07-entregas-y-aceptacion.md).

## Detener y reanudar

```bash
# detener pnpm dev y pnpm worker con Ctrl+C
pnpm env:stop                       # detiene la pila local y conserva los datos

pnpm env:start && pnpm db:migrate   # reanudar
pnpm dev
```

`pnpm db:reset` reconstruye la base desde las migraciones y **borra todos los datos locales**. No forma parte del uso diario; para actualizar una base existente se usa `pnpm db:migrate`.
