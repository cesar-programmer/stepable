# Historial de cambios

## 2026-09-18 · 0.8

- Aceptados para E1.3 RN-09, RN-10, el principio de RN-12 y la comprobación de membresía de RN-11 en listado/detalle; invitaciones, administración y autorización completa siguen pendientes.
- Añadida migración incremental con perfiles ligados a Auth, espacios, membresía única, roles cerrados, responsable inicial y comprobación diferida de al menos un responsable.
- Implementado comando privado para aprovisionar un espacio sobre una identidad existente, con transacción, idempotencia, bloqueo de concurrencia y conflictos explícitos; sin ruta pública o invitaciones.
- Añadidas lista y vista de espacios aisladas por membresía, incluido estado vacío y rechazo de UUID ajeno.
- Sincronizado `.env.local` desde Supabase iniciado sin imprimir/versionar secretos; corregida la URL local de PostgreSQL para scripts y pruebas.
- Migración aplicada sin reset y con la identidad existente conservada; integración real, navegador, formato, lint, tipos, unidades y build aprobados.
- El usuario confirmó que realizó la comprobación manual de E1.3 y funcionó correctamente; no se registran escenarios manuales adicionales.
- E1.3 queda cerrada en un commit local, sin push, E1.4, invitaciones, administración o servicios externos.

## 2026-09-17 · 0.7

- Aceptada e implementada la porción local de identidad de RN-08: correo/contraseña, login/logout, recuperación por Mailpit, validación en servidor y registro público bloqueado.
- Añadidos adaptador Supabase, cookies SSR, páginas y acciones mínimas de identidad, sin espacios, membresías, roles o invitaciones de Stepable.
- Añadido procedimiento interactivo de usuario local sin credenciales fijas ni privilegios de producto.
- Personalizada la recuperación local con token hash de un solo uso y callback no cacheable; enlaces inválidos o reutilizados se rechazan.
- Verificados integración real (3 pruebas), navegador (3 pruebas), formato, lint, tipos, 6 unidades y build; la clave administrativa no apareció en recursos del navegador.
- El usuario comprobó manualmente credenciales incorrectas/correctas, acceso protegido, persistencia al recargar, logout, recuperación desde Mailpit, cambio de contraseña y rechazo del enlace consumido.
- Conservados datos y volúmenes: reinicio normal de Supabase, sin `db reset`.
- E1.2 queda cerrada en un commit local, sin push, E1.3, despliegue o investigación de proveedores.

## 2026-09-17 · 0.6

- Registrada la comprobación manual del usuario: página HTTP 200 y arranque correcto de Supabase.
- Confirmado mediante `docker inspect` que los puertos efectivos se publican solo en `127.0.0.1`; el aviso de Supabase CLI sobre `0.0.0.0` es genérico con la red `stepable-local` configurada.
- Revisado y creado el primer commit local, sin remoto ni push; datos y volúmenes de Supabase conservados.
- Aceptado ADR-002 y aceptados stack/entorno local de ADR-003; acceso y piloto permanecen pendientes.
- Inicializado Git local en `main`, sin remoto, commit o push.
- Creada base Next.js/TypeScript mínima con dependencias exactas y `pnpm-lock.yaml`.
- Inicializada una pila Supabase CLI para PostgreSQL/Auth/Mailpit, limitada a `127.0.0.1`; migración y seed base reproducibles.
- Añadidos configuración tipada, `.env.example`, scripts operativos, Vitest, Playwright, ESLint y Prettier.
- Verificados formato, lint, tipos, unidades, build, arranque HTTP, E2E, reset de base y salud de PostgreSQL/Auth/Mailpit.
- Devueltos correo externo, dominios, alojamiento, proveedores y costos al pendiente del piloto; sin contratación ni despliegue.
- No implementados cuentas, invitaciones, membresías, permisos o E2.

## 2026-09-17 · 0.5

- Aclarado el aprovisionamiento privado del primer espacio y espacios posteriores, sin contraseña predeterminada ni endpoint público.
- Precisada la revocación por espacio, consulta de permisos vigentes y tratamiento de solicitudes en curso.
- Elegida una sola pila local Supabase CLI con PostgreSQL, Auth y Mailpit; eliminada la ambigüedad de servicios duplicados.
- Verificado que Supabase alojado requiere SMTP personalizado para usuarios externos y que Resend necesita dominio de envío controlado/verificado.
- Corregida estimación E1 a 6.67–9.67 USD/mes equivalentes, con reserva de hasta 20 USD/año para dominio.
- Delimitado E1.1 como base reproducible, sin implementar todavía toda E1.
- ADR-002, ADR-003 y todas estas aclaraciones permanecen propuestas; sin código, instalaciones, contratación o despliegue.

## 2026-09-17 · 0.4

- Propuesto ADR-003 con stack TypeScript/Next.js/PostgreSQL y despliegue gradual de ADR-002.
- Separados entorno local sin servicios pagados y piloto estimado en 5–9 USD/mes; verificados precios/límites oficiales de Railway, Supabase y Resend.
- Definidas reglas propuestas RN-08–RN-18 para identidad, invitaciones, responsables, retiro y autorización.
- Dividida E1 en E1.0–E1.8 con aceptación, pruebas y resultados esperados.
- Registradas opciones posteriores de búsqueda híbrida, `pgvector`, jobs e IA sin implementarlas.
- Confirmado que no existe código/configuración ni repositorio Git; sin contratación, despliegue o pruebas de producto.

## 2026-09-17 · 0.3

- Registrado presupuesto indicado de unos 10 USD mensuales para primeras pruebas.
- Actualizados contexto, pendientes y arquitectura para separar pruebas locales del alojamiento del piloto.
- Sin proveedores elegidos, gastos contratados o estimaciones de precios verificadas.

## 2026-09-17 · 0.2

- Desarrollada propuesta de arquitectura modular con API y worker.
- Documentados flujos, propiedad de módulos, permisos, recuperación, versiones y consumo.
- Añadido ADR-002 propuesto y PEN-11 para registrar su revisión.
- Actualizados documentos relacionados y punto de reanudación.
- Sin stack seleccionado, implementación ni pruebas del producto.

## 2026-09-17 · 0.1

- Creada estructura documental y guía de trabajo AGENTS.md.
- Registrados visión, alcance V0, flujos, reglas y orden de entregas.
- Preparados borradores conceptuales de arquitectura, datos e IA, explícitamente pendientes de cierre técnico.
- Separados antecedentes PDF de especificaciones vigentes.
- Registradas preguntas abiertas y punto de reanudación.
- Sin cambios de código ni implementación de funcionalidades.
