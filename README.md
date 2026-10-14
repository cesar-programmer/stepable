# Stepable

**Onboarding interactivo para equipos de software, construido a partir de su propia documentación.**

Stepable convierte la documentación interna de un equipo (guías, convenciones, procesos) en rutas de aprendizaje con lecciones y ejercicios. Además ofrece un asistente que responde preguntas citando las fuentes. Una persona responsable revisa todo lo que genera la IA antes de publicarlo.

> **Estado:** prototipo funcional que se ejecuta en local con documentos sintéticos. No está desplegado ni se ha validado con usuarios reales. Es un producto propio en desarrollo y forma parte de mi portafolio.

---

## Qué hace

### Espacios, roles e invitaciones
- Cada equipo trabaja en un **espacio** con dos roles: *responsable* (prepara el contenido y gestiona el equipo) e *integrante* (aprende y consulta).
- Invitaciones por correo con enlaces de un solo uso que caducan a los siete días, cambio de rol, retirada de acceso y protección del último responsable.
- La autorización se comprueba en el servidor en cada solicitud y las acciones de acceso quedan auditadas.

### Fuentes de conocimiento
- Carga de **Markdown** y **PDF con texto**, procesados en segundo plano por un worker.
- Versiones: al reemplazar un archivo, la versión vigente sigue disponible hasta que la nueva esté lista. Los fallos se pueden reintentar y las fuentes eliminadas se purgan.

### Rutas de onboarding generadas con IA
- La persona responsable indica un **objetivo de aprendizaje**, elige hasta 5 fuentes y los tipos de actividad. La IA redacta un **borrador** usando solo fragmentos de esas fuentes y citándolos.
- Tres tipos de actividad: **opción múltiple**, **lectura de código** y **completar código**, este último con un hueco que se corrige en el servidor por coincidencia exacta.
- Editor por pasos con vista previa, aviso de cambios sin guardar y publicación explícita: la versión publicada ya no cambia.
- Sin evidencia suficiente, el borrador lo indica en lugar de inventar contenido. Si una fuente citada cambia, la ruta queda marcada para revisión.

### Aprendizaje
- Un paso a la vez, con 3 intentos por pregunta, retroalimentación inmediata y desbloqueo progresivo.
- Progreso privado de cada persona y vista de progreso del equipo para los responsables.
- **Ayuda contextual** en cada paso: antes de resolverlo orienta sin dar la respuesta; después explica la solución.

### Asistente con citas
- Responde **solo con las fuentes vigentes del espacio**, con búsqueda híbrida (texto completo y embeddings con pgvector).
- Cada cita se comprueba contra los fragmentos realmente recuperados. Una respuesta con citas inventadas no se muestra.
- Disponible como página y como **panel flotante** desde cualquier vista del espacio.
- Cada consulta es independiente: no guarda historial.

### Control de consumo de IA
- Antes de cada llamada se reserva un costo estimado: hay un límite acumulado del prototipo, otro diario por espacio y otro de consultas diarias por persona.
- Las llamadas que superarían el límite no se hacen.

### Interfaz
- Diseño propio con tokens, **modo claro y oscuro**, sistema de movimiento compartido que respeta `prefers-reduced-motion` y foco visible.
- Navegación por teclado y diseño adaptado a móvil.

---

## Tecnologías

| Área | Tecnología |
| --- | --- |
| Aplicación web | [Next.js 16](https://nextjs.org/) (App Router, Server Actions), React 19, TypeScript |
| Datos | PostgreSQL con [Drizzle ORM](https://orm.drizzle.team/) y `postgres.js`, extensión `pgvector` |
| Autenticación y archivos | [Supabase](https://supabase.com/) (Auth y Storage) en local con Supabase CLI |
| Trabajos en segundo plano | [pg-boss](https://github.com/timgit/pg-boss) (procesamiento de fuentes y generación de rutas) |
| PDF | `pdfjs-dist` |
| IA | OpenAI (`gpt-4.1-mini` y `text-embedding-3-small`) mediante adaptadores; modo simulado para pruebas |
| Validación | Zod |
| Animación | [Motion](https://motion.dev/) y CSS |
| Pruebas | Vitest (unitarias e integración) y Playwright (extremo a extremo) |

## Arquitectura

Es un monolito modular: la web y su API viven juntas, y un worker aparte procesa los trabajos largos.

```
src/
├── app/        # Interfaz (Next.js App Router), acciones de servidor y componentes
├── modules/    # Casos de uso y reglas de negocio, sin dependencias de infraestructura
│               # access · identity · invitations · memberships · sources
│               # knowledge (asistente) · routes · learning · usage (consumo de IA)
├── adapters/   # Implementaciones: PostgreSQL, Supabase, IA, pg-boss, PDF, Mailpit
├── worker/     # Proceso de trabajos en segundo plano
└── lib/        # Utilidades de configuración
supabase/migrations/   # Esquema SQL versionado
tests/                 # Integración (Vitest) y extremo a extremo (Playwright)
docs/                  # Especificación, reglas, decisiones (ADR) y estado
```

Los módulos definen contratos (repositorios, modelos de IA) y los adaptadores los implementan. Así, las reglas se prueban sin infraestructura y los proveedores de IA se pueden sustituir.

---

## Ejecutar en local

### Requisitos

- Node.js 24 y pnpm 11 (vía Corepack)
- Docker o un runtime compatible, para la pila local de Supabase
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Primer arranque

```bash
pnpm install --frozen-lockfile
pnpm env:start      # levanta PostgreSQL, Auth, Storage y Mailpit, y genera .env.local
pnpm db:migrate     # aplica las migraciones pendientes (no borra datos)

pnpm dev            # terminal 1: aplicación en http://127.0.0.1:3000
pnpm worker         # terminal 2: procesamiento de fuentes y generación de rutas
```

Además de la aplicación:
- Supabase Studio: `http://127.0.0.1:54323`
- Mailpit, donde llegan los correos de invitación y recuperación: `http://127.0.0.1:54324`

Todos los servicios escuchan solo en `127.0.0.1`.

### Crear un usuario y un espacio

No hay registro público: los espacios se aprovisionan desde la terminal.

```bash
pnpm auth:create-local-user    # pide correo y contraseña (no la muestra ni la guarda)
pnpm access:bootstrap-space    # crea un espacio y te asigna como responsable
```

Para probar con contenido hay una fuente sintética de ejemplo en `samples/demo/`.

### Configurar la IA (opcional)

Sin configuración, el asistente funciona en modo desactivado y muestra solo los fragmentos encontrados.

Para activar un modelo:
1. Copia las variables comentadas de `.env.example` en **`.env.development.local`**. Git ignora ese archivo y `env:start` no lo sobrescribe.
2. Rellena allí las variables y la clave de API. Nunca las pongas en el código ni en archivos versionados.
3. Reinicia `pnpm dev` y `pnpm worker`.

Los límites de consumo (`STEPABLE_AI_BUDGET_*`) también están en `.env.example`.

### Detener y reanudar

```bash
pnpm env:stop                         # detiene la pila local y conserva los datos
pnpm env:start && pnpm db:migrate     # reanuda
```

> `pnpm db:reset` reconstruye la base desde cero y **borra todos los datos locales**. No forma parte del uso diario.

---

## Pruebas

```bash
pnpm verify             # formato, lint, tipos, pruebas unitarias, revisión de secretos y build
pnpm test:integration   # contra Auth, PostgreSQL y Mailpit locales reales
pnpm test:e2e           # recorridos en el navegador (requiere Chromium de Playwright)
```

- **IA sin coste:** las pruebas fuerzan el modo de IA *simulado* y un espacio de trabajos aislado, así que nunca llaman a un proveedor de pago ni comparten trabajos con un `pnpm worker` en marcha.
- **Datos temporales:** las pruebas crean identidades y espacios desechables y los eliminan al terminar.
- **Pruebas por área:** hay comandos para cada una, como `test:e2e:routes`, `test:e2e:assistant` o `test:integration:sources`; consulta `package.json`.
- **Llamadas reales:** `pnpm assistant:evaluate`, `pnpm routes:evaluate` y `pnpm help:evaluate` sí usan el proveedor real; ejecútalos solo de forma consciente.

---

## Documentación

La carpeta [`docs/`](docs/00-indice.md) es la fuente canónica del producto:

- [Producto](docs/01-producto.md) y [alcance de la V0](docs/02-alcance-v0.md)
- [Flujos y reglas de negocio](docs/03-flujos-y-reglas.md) (identificadores RN-xx)
- [Arquitectura](docs/04-arquitectura.md), [datos y permisos](docs/05-datos-y-permisos.md) e [IA y evaluación](docs/06-ia-y-evaluacion.md)
- [Entregas y pruebas manuales](docs/07-entregas-y-aceptacion.md) y [pendientes](docs/08-pendientes.md)
- [Estado actual](docs/09-estado-actual.md), [historial](docs/10-cambios.md) y [criterios de interfaz](docs/11-interfaz.md)
- [Registro de decisiones (ADR)](docs/decisiones/README.md)

## Estado y próximos pasos

**Implementado y verificado en local:**
- identidad, espacios e invitaciones;
- fuentes Markdown y PDF;
- asistente con citas verificadas;
- generación, edición y publicación de rutas;
- recorrido de aprendizaje con ayuda contextual;
- control de consumo de IA;
- rediseño de la interfaz con modo oscuro.

**Pendiente:**
- rediseño de la gestión de fuentes;
- algunas acciones de gestión, como archivar rutas publicadas o editar su título (ver [pendientes](docs/08-pendientes.md));
- evaluación de la calidad de la IA con documentación real;
- piloto con un equipo.

## Autor

Desarrollado por [César Córdova](https://github.com/cesar-programmer), con apoyo de asistentes de IA para programar.
