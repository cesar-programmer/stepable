# Stepable · Base documental V0

Versión documental: 1.0 · Fecha: 2026-09-19 · Estado: E1.5 cerrada con verificación automática y comprobaciones manuales locales.

Este repositorio contiene la base documental y la aplicación local de Stepable. E1.5 añade invitaciones por espacio capturadas en Mailpit, aceptación explícita para identidades existentes o nuevas y alta/reactivación transaccional de membresías. La administración general de miembros, el piloto y los proveedores siguen pendientes.

## Cómo comenzar

1. Colocar el contenido de esta carpeta en la raíz del repositorio de Stepable. Si ya existen archivos con el mismo nombre, comparar y combinar; no sobrescribir instrucciones existentes sin revisarlas.
2. Leer [AGENTS.md](AGENTS.md) y [el índice](docs/00-indice.md).
3. Retomar desde [el estado actual](docs/09-estado-actual.md).
4. El repositorio Git es local y no tiene remoto. No hacer `push` ni configurar uno por inferencia.

## Desarrollo local

Requisitos: Node.js 24, Corepack/`pnpm` 11, un runtime compatible con Docker y espacio para las imágenes locales de Supabase. Las versiones de dependencias quedan fijadas en `pnpm-lock.yaml`.

```bash
pnpm install --frozen-lockfile
pnpm env:start
pnpm env:status
pnpm db:migrate
pnpm auth:create-local-user
pnpm access:bootstrap-space
pnpm dev
```

`env:start` sincroniza `.env.local` con la pila iniciada; el archivo está ignorado por Git. Supabase CLI puede mostrar claves locales en esa terminal: no copiarlas a reportes ni compartirlas. `db:migrate` aplica solo migraciones pendientes y no reinicia la base. La aplicación abre en `http://127.0.0.1:3000`, Supabase Studio en `http://127.0.0.1:54323` y Mailpit en `http://127.0.0.1:54324`.

Comandos de operación:

```bash
pnpm db:reset      # reconstruye PostgreSQL desde migraciones y seed locales
pnpm db:migrate    # aplica migraciones pendientes sin borrar datos
pnpm env:sync      # actualiza .env.local desde la pila local iniciada
pnpm env:status    # muestra estado y URLs locales
pnpm env:stop      # detiene la pila Supabase
pnpm verify        # formato, lint, tipos, unidades y build
pnpm test:integration:auth # integración real con Auth y Mailpit
pnpm test:integration:access # integridad, bootstrap e aislamiento reales
pnpm test:integration:invitations # estados, atomicidad y concurrencia de invitaciones
pnpm test:e2e:access # listado, detalle, aislamiento y revocación con sesión viva
pnpm test:e2e:invitations # invitaciones con Auth y Mailpit reales
pnpm test:e2e      # recorridos web; requiere pnpm exec playwright install chromium
```

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

`env:start` crea o reutiliza la red Docker `stepable-local` y publica los puertos solo en `127.0.0.1`. Supabase CLI puede mostrar el aviso genérico `All services bind to 0.0.0.0`; la comprobación válida es el enlace efectivo de Docker. Con esta red, `docker inspect` debe mostrar `127.0.0.1` —no `0.0.0.0` ni `::`— para los puertos publicados.

Los documentos son memoria explícita: solo sirven a Codex si están disponibles en su entorno y se consultan. No implican recuerdo automático entre conversaciones.

## Convenciones

- Acordado: dirección expresada por el usuario o alcance aceptado para planificar.
- Propuesto: detalle añadido para concretar el diseño; puede cambiar durante la planificación.
- Pendiente: decisión aún sin respuesta. No equivale a autorización para inventar una especificación.
- Implementado/verificado: requiere evidencia real. E1.1–E1.5 están cerradas con evidencia automatizada y comprobaciones manuales. E1.6 no está autorizada ni iniciada.

La aceptación de la V0 como base de planificación no significa que todos los detalles técnicos estén cerrados. Las instrucciones posteriores del usuario prevalecen; actualizar los documentos afectados para mantener coherencia.
