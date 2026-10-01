# Historial de cambios

## 2026-10-01 · 2.8 · Cierre de E4.1 y aislamiento de pruebas

- El usuario confirmó la comprobación manual de E4.1 y aceptó la entrega; no se le atribuyen escenarios adicionales.
- Añadido el aislamiento entre trabajos de prueba y reales:
  - namespace de colas (`pruebas`);
  - guardia por `spaces.job_namespace` en el worker;
  - Playwright sin reutilizar servidores.

  Verificado sin llamadas reales.
- Registrado un incidente previo: pruebas ejecutadas con el servidor y el worker reales del usuario en marcha. Hechos comprobados: 11 trabajos de prueba completados por su worker. Estimado: 1 llamada corta de generación y unos 5 embeddings; sin importe calculado.
- E4.1 cerrada para el prototipo local en un commit local, sin push. E5.1 autorizada.

## 2026-10-01 · 2.7 · Implementación de E4.1

- Añadidos borradores de onboarding generados con IA a partir de un objetivo y hasta 5 fuentes vigentes. La generación se hace en el worker, con una llamada por intento, sin reintentos de pago, validación de estructura y citas, e insuficiencia sin pasos inventados.
- Edición, reordenamiento y eliminación de pasos con detección de conflictos; publicación revalidada y estable, solo con citas vigentes; lectura para ambos roles sin clave de respuesta para integrantes.
- Citas con estado calculado (vigente, versión anterior o fuente eliminada) y marca “Revisar”; el contenido derivado sobrevive a la eliminación de fuentes.
- Límite de 5 intentos por espacio y día (no es un tope monetario).
- Pruebas técnicas: 64 unitarias, 48 de integración y 22 de navegador. Evaluación real con 2 generaciones (1017/590 tokens). Sin comprobación manual atribuida, commit ni push.

## 2026-10-01 · 2.6 · Cierre de E3

- El usuario confirmó la comprobación manual del asistente con IA real y aceptó la entrega; no se le atribuyen escenarios adicionales.
- La evidencia queda separada en pruebas técnicas, evaluación con modelo real y comprobación manual. Se reutilizó la verificación técnica, sin nuevas llamadas de pago.
- E3 cerrada para el prototipo local. Historial de conversaciones pospuesto. Limitaciones conservadas: evaluación pequeña, prueba de instrucciones maliciosas pendiente y sin límites acumulados de gasto.
- Commit local, sin push.

## 2026-10-01 · 2.5 · Evaluación inicial de E3 con modelo real

- El usuario eligió y configuró OpenAI `gpt-4.1-mini` y `text-embedding-3-small`. La configuración se copió de `.env.local` a `.env.development.local` para que `env:sync` no la borre.
- `pnpm assistant:evaluate`: directa y parafraseada respondidas con cita correcta, sin respuesta → insuficiente, otro espacio rechazado; 3 llamadas de conversación. Resultados separados de las pruebas técnicas.
- Sin commit ni push; comprobación manual pendiente.

## 2026-10-01 · 2.4 · Prototipo de E3 (asistente con evidencia)

- El experimento léxico con documentos sintéticos falló en las 3 paráfrasis; se añadió recuperación semántica con pgvector, fusionada por rango recíproco.
- Añadidos el asistente por espacio con una llamada acotada a un modelo configurable (cliente compatible con la API de OpenAI), citas construidas desde los fragmentos, rechazo de citas inventadas y reconocimiento de falta de evidencia; sin historial.
- La conversación y los embeddings se configuran por separado y están desactivados por defecto; las pruebas fuerzan el modo simulado. Script `pnpm assistant:evaluate` para la evaluación real.
- Pruebas técnicas aprobadas: 56 unitarias, 42 de integración y 20 de navegador. Evaluación con modelo real no realizada; sin llamadas de pago, commit ni push.

## 2026-10-01 · 2.3 · Cierre de E2.4 y de E2

- El usuario confirmó la prueba manual de E2.4 y aceptó la entrega. Aclaró que la comprobación de E2.3 se hizo en otro entorno. No se le atribuyen pasos adicionales.
- La confirmación manual se registra separada de la evidencia automática, que se reutiliza porque solo cambió documentación.
- Archivos huérfanos aceptados como limitación del prototipo local (PEN-12), pendientes antes de documentación real o despliegue; distintos de la purga de fuentes eliminadas, ya implementada.
- E2 cerrada para el prototipo local; ADR-004 aceptado. Commit local, sin push. E3 no iniciada.

## 2026-10-01 · 2.2 · Implementación de E2.4

- Añadida la eliminación de fuentes por responsables activos, con casilla y diálogo de confirmación. El retiro es inmediato para ambos roles y no hay papelera.
- El worker purga originales y texto de todas las versiones mediante la cola `purgar-fuente`, con reintentos y re-encolado de purgas pendientes. Quedan metadatos mínimos sin título ni SHA-256.
- La finalización del procesamiento bloquea primero la fuente: trabajos pendientes o en curso no reactivan una fuente eliminada.
- Auditoría de fuentes (cargar, reemplazar, reintentar, eliminar) en `access_audit_events`, en la misma transacción.
- Documentada la política de conservación y la dependencia de futuras citas y lecciones; señalado como pendiente de cierre la conciliación de huérfanos.
- Aprobadas 48 pruebas unitarias, 36 de integración y 18 de navegador. Sin comprobación manual atribuida, commit ni push.

## 2026-10-01 · 2.1 · Cierre de E2.3

- El usuario confirmó que la comprobación manual de E2.3 funcionó correctamente y aceptó la entrega; no se le atribuyen escenarios adicionales.
- El estado agregado de la base local no muestra versiones de reemplazo; se registra como dato, sin interpretación.
- Se reutiliza la verificación automática aprobada; no cambió código después de ella. E2.3 queda en un commit local, sin push, y E2.4 queda autorizada.

## 2026-10-01 · 2.0 · Implementación de E2.3

- Añadidos el reemplazo de fuentes con versión candidata y cambio atómico de la vigente, y el reintento manual (hasta 3 por versión fallida) sin trabajos duplicados.
- Una candidata fallida no afecta a la vigente y muestra su motivo. Un archivo corregido deja la fallida como `descartada`; las anteriores se conservan como `reemplazada`, sin historial visible ni purga hasta E2.4.
- Migración incremental `manual_retries`; datos locales conservados.
- Aprobadas 46 pruebas unitarias, 34 de integración y 17 de navegador. Sin comprobación manual atribuida, commit ni push.

## 2026-10-01 · 1.9 · Cierre de E2.2

- El usuario confirmó que la prueba manual de E2.2 funcionó correctamente y aceptó la entrega; no se le atribuyen comprobaciones adicionales.
- Se reutiliza la verificación automática aprobada; después solo cambió el formato de un script.
- E2.2 queda consolidada en un commit local, sin push. E2.3 queda autorizada.

## 2026-10-01 · 1.8 · Implementación de E2.2

- Añadida la carga de PDF con texto (≤ 8 MiB, ≤ 200 páginas, sin cifrar, sin OCR) con firma validada en la carga.
- Extracción por página con `pdfjs-dist` 6.3.289 en un hilo aislado con memoria y tiempo limitados. PDF sin texto, cifrados, dañados o fuera de límites terminan en “Falló” con un motivo comprensible; los cortos con texto se aceptan.
- Migración incremental para la ubicación por página y el número de páginas; Markdown y permisos sin cambios.
- Añadidos un generador de PDF sintéticos para pruebas y `pnpm sources:sample-pdfs` para la prueba manual.
- Aprobadas 46 pruebas unitarias, 33 de integración y 16 de navegador. Sin comprobación manual atribuida, commit ni push.

## 2026-10-01 · 1.7 · Cierre de E2.1

- El usuario confirmó que la prueba manual de E2.1 funcionó correctamente y aceptó la entrega; no se le atribuyen escenarios adicionales.
- Se reutiliza la verificación automática aprobada, porque el código no cambió después de ella.
- E2.1 queda consolidada en un commit local, sin push. E2.2 queda autorizada con PDF ≤ 8 MiB, ≤ 200 páginas, sin cifrado y sin OCR.

## 2026-10-01 · 1.6 · Implementación de E2.1

- Implementado el recorrido mínimo de fuentes Markdown:
  - carga por Route Handler a un bucket privado de Storage;
  - encolado transaccional en `pg-boss` y procesamiento en `pnpm worker`;
  - segmentación por encabezados;
  - estados visibles y lectura por rol.
- Ajustes del usuario a ADR-004:
  - se aceptan documentos cortos y solo se rechazan los vacíos;
  - `pg-boss` en lugar de cola propia, con su esquema versionado como migración generada por su CLI;
  - conservación y eliminación se deciden en E2.3/E2.4.
- Añadidas las acciones centrales `consultar_fuentes` y `gestionar_fuentes`. Tablas, bucket y esquema `pgboss` quedan cerrados a los roles del navegador.
- Aprobadas 6 pruebas de integración y 3 de navegador nuevas, más la regresión completa: 41 unitarias, 32 de integración y 15 de navegador.
- Migraciones incrementales sin reset; datos locales conservados. Sin comprobación manual atribuida, commit ni push.

## 2026-10-01 · 1.5 · Planificación propuesta de E2

- Propuesto ADR-004: Supabase Storage local con bucket privado, cola propia en PostgreSQL, worker separado, `pdfjs-dist` para PDF, Markdown sin dependencia y carga por Route Handler.
- Propuestos formatos, límites, errores y procesamiento (04 §19), RN-19–RN-25 de vigencia, reemplazo y eliminación (03), acciones, modelo y conservación (05) y el plan E2.1–E2.4 (07).
- Actualizados PEN-04, PEN-06, PEN-07 y PEN-08 con las propuestas, sin cerrarlos.
- Registrados como pendientes menores de E1 los textos “E1.6” y la diferencia de longitud mínima de contraseña.
- E1 se conserva cerrada. Sin código, dependencias, cambios de base, commit ni despliegue.

## 2026-10-01 · 1.4 · Cierre de E1.7 y de E1

- Repetida la evidencia automática sin cambios de código: verify, 26 de integración, 12 de navegador y `git diff --check` aprobados.
- El usuario revisó E1.7, comprobó manualmente la Data API cerrada y la auditoría desde la interfaz, y aceptó la entrega. Reenvío y retiro por responsable conservan solo evidencia automatizada.
- Actualizado el estado de ADR-003 y de su índice; E1 queda cerrada localmente y consolidada en un commit local, sin push.
- No se inició E2, piloto ni proveedores.

## 2026-09-21 · 1.3 · Implementación y verificación de E1.7

- Añadida auditoría mínima de acceso con acciones/tipos cerrados e identificadores de actor, espacio y objetivo; no persiste correos, tokens, contraseñas, enlaces, cookies, claves o metadatos libres.
- Bootstrap, ciclo de invitaciones, cambio de rol, retiro y autosalida escriben su evento en la misma transacción exitosa; rechazos, repeticiones idempotentes y rollbacks no registran éxitos falsos.
- Corregida la revalidación de permisos dentro de las transacciones de crear, reenviar y cancelar invitaciones ante cambios concurrentes de membresía.
- Habilitada RLS y revocados los privilegios de `anon`/`authenticated` en todas las tablas E1 para impedir que la Data API eluda la política central del servidor.
- Añadidas prueba de integración de auditoría, revisión de higiene de archivos versionables y búsqueda ampliada de credenciales de servidor en recursos del navegador.
- Migraciones incrementales aplicadas sin reset ni eliminación de volúmenes; los datos locales existentes se conservaron y los fixtures efímeros se limpiaron.
- Aprobadas 26 pruebas de integración, 12 de navegador y 26 unitarias, además de formato, lint, tipos, higiene, build y `git diff --check`.
- Consolidada la operación local en README y relacionada la evidencia de RF-01/RF-02/CA-01. No se realizó ni se atribuye una comprobación manual nueva; E1.7 espera revisión final y permanece sin commit ni push.

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
