# Stepable · Base documental V0

Versión documental: 0.6 · Fecha: 2026-09-17 · Estado: base local E1.1 implementada y verificada.

Este repositorio contiene la base documental y el cascarón local de Stepable. La arquitectura modular y el stack local están aprobados; las reglas de acceso, el piloto y las decisiones de proveedores siguen pendientes. E1.1 no implementa todavía cuentas, espacios, membresías o invitaciones.

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
pnpm dev
```

Después de `env:start`, copiar a `.env.local` la URL y clave publicable locales mostradas por `env:status`. El archivo está ignorado por Git. La aplicación abre en `http://127.0.0.1:3000`, Supabase Studio en `http://127.0.0.1:54323` y Mailpit en `http://127.0.0.1:54324`.

Comandos de operación:

```bash
pnpm db:reset      # reconstruye PostgreSQL desde migraciones y seed locales
pnpm env:status    # muestra estado y URLs locales
pnpm env:stop      # detiene la pila Supabase
pnpm verify        # formato, lint, tipos, unidades y build
pnpm test:e2e      # smoke test web; requiere pnpm exec playwright install chromium
```

`env:start` crea o reutiliza la red Docker `stepable-local` y publica los puertos solo en `127.0.0.1`. Supabase CLI puede mostrar el aviso genérico `All services bind to 0.0.0.0`; la comprobación válida es el enlace efectivo de Docker. Con esta red, `docker inspect` debe mostrar `127.0.0.1` —no `0.0.0.0` ni `::`— para los puertos publicados.

Los documentos son memoria explícita: solo sirven a Codex si están disponibles en su entorno y se consultan. No implican recuerdo automático entre conversaciones.

## Convenciones

- Acordado: dirección expresada por el usuario o alcance aceptado para planificar.
- Propuesto: detalle añadido para concretar el diseño; puede cambiar durante la planificación.
- Pendiente: decisión aún sin respuesta. No equivale a autorización para inventar una especificación.
- Implementado/verificado: requiere evidencia real. Solo la base local E1.1 tiene ese estado.

La aceptación de la V0 como base de planificación no significa que todos los detalles técnicos estén cerrados. Las instrucciones posteriores del usuario prevalecen; actualizar los documentos afectados para mantener coherencia.
