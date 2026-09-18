# Stepable · Base documental V0

Versión documental: 0.7 · Fecha: 2026-09-17 · Estado: E1.2 cerrada y comprobada localmente; E1.3 no iniciada.

Este repositorio contiene la base documental y la aplicación local de Stepable. La arquitectura, el stack y la identidad local de E1.2 están aprobados: correo/contraseña, sesión, recuperación mediante Mailpit y ausencia de registro público. Espacios, membresías, roles, invitaciones de Stepable, piloto y proveedores siguen pendientes.

## Cómo comenzar

1. Colocar el contenido de esta carpeta en la raíz del repositorio de Stepable. Si ya existen archivos con el mismo nombre, comparar y combinar; no sobrescribir instrucciones existentes sin revisarlas.
2. Leer [AGENTS.md](AGENTS.md) y [el índice](docs/00-indice.md).
3. Retomar desde [el estado actual](docs/09-estado-actual.md).
4. El repositorio Git es local y no tiene remoto. No hacer `push` ni configurar uno por inferencia.

## Desarrollo local

Requisitos: Node.js 24, Corepack/`pnpm` 11, un runtime compatible con Docker y espacio para las imágenes locales de Supabase. Las versiones de dependencias quedan fijadas en `pnpm-lock.yaml`.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm env:start
pnpm env:status
pnpm auth:create-local-user
pnpm dev
```

Después de `env:start`, copiar a `.env.local` la URL y clave publicable locales mostradas por `env:status`. El archivo está ignorado por Git. La aplicación abre en `http://127.0.0.1:3000`, Supabase Studio en `http://127.0.0.1:54323` y Mailpit en `http://127.0.0.1:54324`.

Comandos de operación:

```bash
pnpm db:reset      # reconstruye PostgreSQL desde migraciones y seed locales
pnpm env:status    # muestra estado y URLs locales
pnpm env:stop      # detiene la pila Supabase
pnpm verify        # formato, lint, tipos, unidades y build
pnpm test:integration:auth # integración real con Auth y Mailpit
pnpm test:e2e      # recorridos web; requiere pnpm exec playwright install chromium
```

`pnpm auth:create-local-user` solicita correo y contraseña de forma interactiva, no muestra la contraseña y no guarda credenciales. Crea solo una identidad confirmada en Supabase Auth local; no crea administrador de Stepable, espacio, membresía ni rol.

### Comprobación manual de E1.2

1. Crear el usuario con `pnpm auth:create-local-user` y arrancar la aplicación con `pnpm dev`.
2. Abrir `http://127.0.0.1:3000/login`, iniciar sesión y comprobar `/protected`.
3. Recargar `/protected`, cerrar sesión y comprobar que volver a esa ruta redirige al login.
4. En `/recover`, solicitar recuperación para el mismo correo.
5. Abrir `http://127.0.0.1:54324`, entrar al mensaje más reciente y seguir el enlace para establecer una contraseña nueva.
6. Comprobar que el enlace usado se rechaza y que solo la contraseña nueva permite iniciar sesión.

`env:start` crea o reutiliza la red Docker `stepable-local` y publica los puertos solo en `127.0.0.1`. Supabase CLI puede mostrar el aviso genérico `All services bind to 0.0.0.0`; la comprobación válida es el enlace efectivo de Docker. Con esta red, `docker inspect` debe mostrar `127.0.0.1` —no `0.0.0.0` ni `::`— para los puertos publicados.

Los documentos son memoria explícita: solo sirven a Codex si están disponibles en su entorno y se consultan. No implican recuerdo automático entre conversaciones.

## Convenciones

- Acordado: dirección expresada por el usuario o alcance aceptado para planificar.
- Propuesto: detalle añadido para concretar el diseño; puede cambiar durante la planificación.
- Pendiente: decisión aún sin respuesta. No equivale a autorización para inventar una especificación.
- Implementado/verificado: requiere evidencia real. E1.1 y E1.2 están cerradas con evidencia automatizada y comprobación manual; E1.3 no está autorizada ni iniciada.

La aceptación de la V0 como base de planificación no significa que todos los detalles técnicos estén cerrados. Las instrucciones posteriores del usuario prevalecen; actualizar los documentos afectados para mantener coherencia.
