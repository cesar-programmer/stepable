# Stepable · Base documental V0

Versión documental: 2.1 · Fecha: 2026-10-01 · Estado: E1 y E2.1–E2.3 cerradas localmente; E2.4 (eliminación de fuentes) en curso.

Este repositorio contiene la base documental y la aplicación local de Stepable. E1 implementa identidad, espacios, invitaciones, membresías, autorización vigente y auditoría mínima de mutaciones de acceso. El piloto y los proveedores siguen pendientes.

## Cómo comenzar

1. Colocar el contenido de esta carpeta en la raíz del repositorio de Stepable. Si ya existen archivos con el mismo nombre, comparar y combinar; no sobrescribir instrucciones existentes sin revisarlas.
2. Leer [AGENTS.md](AGENTS.md) y [el índice](docs/00-indice.md).
3. Retomar desde [el estado actual](docs/09-estado-actual.md).
4. El repositorio Git es local y no tiene remoto. No hacer `push` ni configurar uno por inferencia.

## Operación local reproducible

Requisitos: Node.js 24, Corepack/`pnpm` 11, un runtime compatible con Docker y espacio para las imágenes locales de Supabase. Las versiones de dependencias quedan fijadas en `pnpm-lock.yaml`.

Instalación y primer arranque:

```bash
pnpm install --frozen-lockfile
pnpm env:start
pnpm env:status
pnpm db:migrate
pnpm dev        # terminal 1: aplicación web
pnpm worker     # terminal 2: procesamiento de fuentes (pg-boss)
```

`env:start` crea o reutiliza una sola pila local de PostgreSQL/Auth/Mailpit y sincroniza `.env.local`; el archivo está ignorado por Git. Supabase CLI puede mostrar claves locales en esa terminal: no copiarlas a reportes ni compartirlas. `db:migrate` aplica solo migraciones pendientes y no reinicia la base. La aplicación abre en `http://127.0.0.1:3000`, Supabase Studio en `http://127.0.0.1:54323` y Mailpit en `http://127.0.0.1:54324`.

Preparación opcional de datos locales:

```bash
pnpm auth:create-local-user
pnpm access:bootstrap-space
```

Comprobación completa:

```bash
pnpm verify             # formato, lint, tipos, unidades, higiene y build
pnpm test:integration   # Auth, PostgreSQL y Mailpit locales reales
pnpm test:e2e           # recorridos web; requiere Chromium de Playwright
pnpm security:check     # archivos versionables, secretos y correos no reservados
```

Comandos focalizados disponibles: `test:integration:auth`, `test:integration:access`, `test:integration:invitations`, `test:integration:memberships`, `test:integration:audit`, `test:e2e:auth`, `test:e2e:access`, `test:integration:sources`, `test:e2e:invitations`, `test:e2e:memberships` y `test:e2e:sources`. Las pruebas de fuentes arrancan su propio worker.

Detención y reanudación:

```bash
# detener pnpm dev y pnpm worker con Ctrl+C
pnpm env:stop

# reanudar sin borrar datos
pnpm env:start
pnpm db:migrate
pnpm dev
```

`pnpm db:reset` es destructivo y no forma parte de la operación diaria: reconstruye una base descartable desde las migraciones y solo debe usarse con autorización expresa. Para actualizar la base existente se usa `pnpm db:migrate`.

`pnpm auth:create-local-user` solicita correo y contraseña de forma interactiva, no muestra la contraseña y no guarda credenciales. Crea solo una identidad confirmada en Supabase Auth local; no crea administrador de Stepable, espacio, membresía ni rol.

`pnpm access:bootstrap-space` solicita el correo de una identidad local existente, un `slug` estable y el nombre visible. Crea transaccionalmente el perfil, espacio y primera membresía `responsable`. Repetir los mismos datos es idempotente; un nombre o responsable inicial diferente produce conflicto. No crea identidades ni modifica contraseñas y no existe una ruta web para aprovisionar espacios.

### Comprobación manual de E1.2

1. Crear el usuario con `pnpm auth:create-local-user` y arrancar la aplicación con `pnpm dev`.
2. Abrir `http://127.0.0.1:3000/login`, iniciar sesión y comprobar `/protected`.
3. Recargar `/protected`, cerrar sesión y comprobar que volver a esa ruta redirige al login.
4. En `/recover`, solicitar recuperación para el mismo correo.
5. Abrir `http://127.0.0.1:54324`, entrar al mensaje más reciente y seguir el enlace para establecer una contraseña nueva.
6. Comprobar que el enlace usado se rechaza y que solo la contraseña nueva permite iniciar sesión.

### Comprobación manual de E1.3

1. Con la identidad local ya creada, ejecutar `pnpm access:bootstrap-space` y completar correo, `slug` y nombre.
2. Arrancar la aplicación con `pnpm dev` e iniciar sesión.
3. Abrir `http://127.0.0.1:3000/spaces` y comprobar el nombre y el rol `responsable`.
4. Abrir el espacio desde la lista y confirmar que muestra el mismo nombre, `slug` y rol.
5. Repetir el comando con los mismos datos y confirmar que informa que el espacio ya estaba aprovisionado sin duplicarlo.

### Comprobación local de E1.4

No existe todavía una interfaz para cambiar roles o revocar membresías. Esos comportamientos se comprueban sin editar datos manualmente mediante fixtures efímeros que se eliminan al terminar:

```bash
pnpm db:migrate
pnpm test:integration:access
pnpm test:e2e:access
```

La integración ejercita la matriz de acciones, ausencia/revocación, cambio de rol, último responsable activo y bootstrap. El recorrido de navegador mantiene una sesión abierta, revoca solo un espacio de prueba y confirma 404 para ese espacio, sesión global vigente y acceso conservado a otro espacio. Los comandos no modifican el espacio aprovisionado manualmente.

### Comprobación manual de E1.5

1. Iniciar sesión como `responsable`, abrir el espacio y elegir **Gestionar invitaciones**.
2. Indicar el correo invitado. Dejar `integrante` o seleccionar `responsable` de forma explícita y enviar.
3. Abrir Mailpit en `http://127.0.0.1:54324`, localizar el mensaje **Invitación a…** y abrir su enlace en un segundo perfil o contexto de navegador. Abrirlo solo muestra la invitación; no crea membresía.
4. Si la identidad ya existe, iniciar sesión en ese segundo contexto. Si es nueva, usar **Configurar cuenta nueva**, abrir el correo separado de Auth en Mailpit, establecer la contraseña y volver a la pestaña de aceptación ya autenticada.
5. Pulsar **Aceptar invitación** y comprobar que el espacio aparece con el rol elegido.
6. Para comprobar rotación, crear otra invitación, conservar el primer mensaje, usar **Reenviar** y confirmar que el primer enlace falla y el nuevo funciona. Para cancelación, usar **Cancelar** y comprobar que el enlace ya no permite aceptar.

No copiar tokens a la terminal. La interfaz no los muestra y el servidor guarda solo su hash.

### Comprobación manual de E1.6

Usar dos identidades con membresía activa en el mismo espacio, una `responsable` y otra `integrante`, en dos perfiles o contextos de navegador separados:

1. Como responsable, abrir **Gestionar miembros** y promover al integrante a `responsable`; confirmar en la segunda sesión que el nuevo rol y el acceso a administración aparecen al recargar.
2. Como responsable original, cambiar el propio rol a `integrante`; debe salir de administración y permanecer en el detalle. El segundo responsable conserva el control.
3. Desde la segunda sesión, devolver al usuario original el rol `responsable` para asegurar que siempre quede al menos uno.
4. En la segunda sesión, usar **Abandonar espacio**. Debe volver a la lista de espacios; la sesión global sigue abierta y otros espacios no cambian.
5. Como responsable restante, comprobar en **Gestionar miembros** que la membresía aparece `revocada` y no ofrece cambio de rol ni reactivación directa.

No intentar retirar o degradar simultáneamente a ambos responsables durante la comprobación manual; las carreras y la protección del último responsable se cubren con fixtures automatizados.

### Comprobación manual de E2.1

Usar solo documentos sintéticos. Seguir la [prueba manual de E2.1](docs/07-entregas-y-aceptacion.md#e21--prueba-manual). Sin `pnpm worker` en marcha, las fuentes quedan “En cola”.

### Comprobación manual de E2.2

`pnpm sources:sample-pdfs` escribe PDF sintéticos de ejemplo (con texto, corto, escaneado, cifrado, dañado y de 201 páginas) en la carpeta temporal del sistema. Seguir la [prueba manual de E2.2](docs/07-entregas-y-aceptacion.md#e22--prueba-manual).

### Comprobación manual de E2.3

Seguir la [prueba manual de E2.3](docs/07-entregas-y-aceptacion.md#e23--prueba-manual).

`env:start` crea o reutiliza la red Docker `stepable-local` y publica los puertos solo en `127.0.0.1`. Supabase CLI puede mostrar el aviso genérico `All services bind to 0.0.0.0`; la comprobación válida es el enlace efectivo de Docker. Con esta red, `docker inspect` debe mostrar `127.0.0.1` —no `0.0.0.0` ni `::`— para los puertos publicados.

Los documentos son memoria explícita: solo sirven a Codex si están disponibles en su entorno y se consultan. No implican recuerdo automático entre conversaciones.

## Convenciones

- Acordado: dirección expresada por el usuario o alcance aceptado para planificar.
- Propuesto: detalle añadido para concretar el diseño; puede cambiar durante la planificación.
- Pendiente: decisión aún sin respuesta. No equivale a autorización para inventar una especificación.
- Implementado/verificado: requiere evidencia real. E1.1–E1.7 están cerradas con evidencia automatizada y comprobaciones manuales delimitadas en el estado actual.

La aceptación de la V0 como base de planificación no significa que todos los detalles técnicos estén cerrados. Las instrucciones posteriores del usuario prevalecen; actualizar los documentos afectados para mantener coherencia.
