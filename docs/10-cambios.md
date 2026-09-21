# Historial de cambios

## 2026-09-21 · 1.2 · Cierre de E1.6

- El usuario confirmó que la comprobación manual de E1.6 funcionó correctamente y aceptó la entrega; no se le atribuyen comprobaciones manuales adicionales.
- Se conserva por separado la evidencia automatizada ya aprobada: 24 pruebas de integración, 12 de navegador, 26 unitarias, formato, lint, tipos y build.
- E1.6 queda cerrada y consolidada en el commit local solicitado, sin push. E1.7 no se inició y no se avanzó a E2, alojamiento o proveedores.

## 2026-09-19 · 1.1 · Implementación de E1.6

- Aceptadas para E1.6 la gestión de otros miembros y de la propia membresía, la autosalida del integrante, la visibilidad de revocadas y la reactivación exclusiva mediante nueva invitación.
- Añadida `abandonar_espacio` a la política central; ambos roles activos pueden abandonar solo su propia membresía y únicamente responsables activos conservan `gestionar_miembros`.
- Implementados listado administrativo aislado, cambio de rol, retiro y autosalida con confirmación y navegación posterior coherente.
- Las mutaciones se serializan por espacio y revalidan dentro de la transacción los permisos actuales del actor, el objetivo y el último responsable activo; la restricción diferida permanece como respaldo.
- No se añadió migración: el estado y el invariante de E1.4 cubren E1.6. No hubo reset ni modificación deliberada de datos manuales.
- Aprobadas 6 pruebas nuevas de integración y 3 de navegador; la regresión completa suma 24 de integración, 12 de navegador y 26 unitarias, además de formato, lint, tipos y build. En ese momento, la comprobación manual de E1.6 y el commit permanecían pendientes.
- Sin reactivación directa, auditoría de E1.7, E2, servicios externos, despliegue o push.

## 2026-09-19 · 1.0 · Cierre de E1.5

- El usuario comprobó una invitación para identidad nueva: configuración de cuenta, inicio de sesión, aceptación y entrada al espacio como `integrante`; resultado correcto.
- En una comprobación manual separada, el usuario confirmó que reenviar invalidó el enlace anterior, el enlace nuevo mostró la invitación pendiente y cancelar impidió aceptarla.
- No se atribuyen al usuario pruebas manuales de usuario existente, rol `responsable`, vencimiento o concurrencia; esos escenarios conservan evidencia automatizada.
- E1.5 queda cerrada y consolidada en el commit local solicitado; no se avanzó a E1.6.

## 2026-09-18 · 1.0

- Aceptadas para E1.5 invitaciones de siete días, integrante predeterminado, responsable explícito, cuenta Auth separada de aceptación Stepable, reactivación con el rol invitado y preservación del rol activo.
- Añadida migración incremental de invitaciones con correo normalizado, estados, entrega, vencimiento, token hasheado y unicidad de pendiente por correo/espacio; aplicada sin reset y con los datos manuales conservados.
- Implementados creación, lista, reenvío y cancelación desde una interfaz mínima, autorizados por la política central solo para responsables activos.
- Implementada aceptación explícita: abrir el enlace no consume, el token se retira del fragmento, identidad/correo verificado coinciden y membresía/consumo se confirman en una transacción.
- Añadido flujo local para identidades nuevas mediante un correo separado de Supabase Auth en Mailpit, sin registro público y sin cambiar contraseñas existentes.
- Cubiertos usuario existente/nuevo, ambos roles, entrega fallida, rotación, cancelación, vencimiento, token/correo incorrectos, aislamiento, membresías activas/revocadas, doble aceptación y carreras con reenvío/cancelación.
- Superadas la suite completa de integración (18), navegador (9), formato, lint, tipos, unidades (22) y build; la clave administrativa no aparece en recursos del navegador y los fixtures no dejaron datos residuales.
- En ese momento, E1.5 esperaba comprobación manual y permanecía sin commit ni push; E1.6, piloto y proveedores no se habían adelantado.

## 2026-09-18 · 0.9

- Aceptadas para E1.4 la matriz mínima, la consulta de identidad/membresía/rol por solicitud, la denegación predeterminada y la conservación de membresías revocadas sin cerrar la sesión global.
- Añadida migración incremental de estado `activa`/`revocada`; filas existentes conservadas como activas y último responsable ajustado para contar solo responsables activos.
- Implementada política central con acciones explícitas para consultar espacio, gestionar invitaciones y gestionar miembros; las interfaces/endpoints de gestión siguen en E1.5/E1.6.
- Integrados listado y detalle con la política; revocadas se excluyen y el detalle inaccesible conserva 404.
- Ajustado el bootstrap para informar conflicto sin reactivar una membresía revocada ni restaurar un rol.
- Migración aplicada sin reset; identidad, espacio y membresía manual existentes conservados. Los fixtures de prueba no dejaron espacios residuales.
- Superadas integración real (11 pruebas), navegador (6 pruebas), formato, lint, tipos, 16 unidades y build.
- El usuario comprobó manualmente que su espacio sigue en el listado, puede abrirlo y conserva el rol `responsable`; no se registran escenarios manuales adicionales.
- E1.4 queda cerrada en un commit local, sin push, E1.5, administración o servicios externos.
- Sin invitaciones, endpoints administrativos, reincorporación, servicios externos, contratación o despliegue.

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
