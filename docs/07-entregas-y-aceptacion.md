# Entregas y aceptación

Estado: secuencia inicial de planificación; sin fechas comprometidas.
Actualizado: 2026-09-18.

## Etapa actual: E1.4 cerrada; E1.5 no iniciada

Arquitectura modular, stack, identidad, espacios y política local de autorización están aceptados en ADR-003. E1.4 implementa la matriz mínima, estado activo/revocado y revalidación por solicitud; cuenta con evidencia automatizada y comprobación manual confirmada por el usuario. Invitaciones, operaciones administrativas, piloto y proveedores no están autorizados.

| Entrega | Requisitos | Evidencia propuesta de cierre |
| --- | --- | --- |
| E1 Base y acceso | RF-01, RF-02 | CA-01: dos roles acceden a su espacio; accesos no autorizados rechazados, incluida manipulación de identificadores |
| E2 Fuentes | RF-03 | CA-02: archivo permitido llega a listo, error se ve y se puede reintentar sin duplicar resultados |
| E3 Asistente | RF-08 | CA-03: preguntas de referencia producen evidencia resoluble; preguntas sin respaldo reconocen insuficiencia; chats aislados |
| E4 Autoría | RF-04, RF-05 | CA-04: borrador editable, publicación solo por responsable y versión publicada estable |
| E5 Aprendizaje | RF-06, RF-07, RF-09 | CA-05: actividad evaluada con criterios revisados, progreso retomable y seguimiento autorizado |
| E6 Piloto | Recorrido completo | CA-06: prueba documentada con usuarios invitados, incidencias y consumo registrado |

RF-10 es transversal: errores y límites deben incorporarse en las entregas que consumen recursos. El chat contextual de lecciones se integra en E5; E3 entrega el chat general.

## Regla de cierre

Una entrega no está completada por tener archivos. Requiere comportamiento observado, verificaciones pertinentes y límites documentados. E1.1–E1.4 tienen evidencia automatizada y comprobación manual; las entregas posteriores todavía no tienen resultados.

Las pruebas deben cubrir aislamiento, permisos, referencias/versiones, recuperación de fallos y progreso. No fijar un número de pruebas como objetivo de calidad.

La V0 funcional termina cuando onboarding y consulta permanente operan juntos. Utilidad comercial y disposición a pagar siguen siendo hipótesis hasta obtener evidencia externa.

## Plan ejecutable de E1

E1 no incluye fuentes, procesamiento, archivos, búsqueda ni IA. Cada paso produce una porción demostrable y conserva el sistema ejecutable. [ADR-003](decisiones/ADR-003-stack-y-acceso-e1.md) acepta stack, entorno, identidad, espacios y autorización local hasta E1.4; invitaciones y administración siguen pendientes.

| Paso | Trabajo | Criterio de aceptación | Pruebas pertinentes | Resultado esperado |
| --- | --- | --- | --- | --- |
| E1.0 Cerrar contrato | Resolver ADR-002/ADR-003, vigencia de invitación y política del último responsable | No quedan decisiones de comportamiento E1 ambiguas; PEN-02/PEN-05 se cierran o se dividen con dueño | Revisión cruzada RF-01/RF-02, RN-03 y RN-08–RN-18 | Base aprobada para implementar sin contratar ni desplegar |
| E1.1 Base reproducible | Crear workspace, cascarón Next.js, configuración validada y una pila Supabase CLI local con Postgres/Auth/Mailpit; definir un único historial SQL | Un desarrollador nuevo puede iniciar/detener entorno, migrar desde cero y ejecutar verificaciones documentadas sin servicios duplicados | Instalación limpia, `env:start/status/stop`, reset local, lint, tipos y prueba mínima | Proyecto ejecutable localmente; sin cuentas, espacios, permisos ni flujo de bootstrap implementados todavía |
| E1.2 Identidad | Integrar Supabase Auth local detrás de un adaptador: usuario operativo de prueba, login, sesión, recuperación, cambio de contraseña y logout; sin registro público | Usuario válido entra/sale/recupera; credenciales incorrectas, acceso anónimo y enlaces inválidos/usados se rechazan; la página protegida valida identidad en servidor | Unidades de entrada, integración con Auth/Mailpit reales, E2E de sesión/recuperación y revisión de clave administrativa | Identidad autenticada y comprobable localmente, aún separada de espacios y autorización |
| E1.3 Espacios y membresías | Persistir perfiles, espacios, membresías, roles y bootstrap | Primer responsable/espacio se crea una sola vez; usuario puede listar solo sus espacios | Restricciones/índices en PostgreSQL real, concurrencia de bootstrap, manipulación de ID | Fuente de verdad de acceso por espacio |
| E1.4 Autorización | Implementar políticas centrales y matriz mínima | Responsable e integrante acceden solo a acciones permitidas; sin membresía se deniega por defecto | Tabla de pruebas rol × acción, acceso horizontal/vertical, membresía retirada con sesión viva | CA-01 cubierto en backend, no solo en UI |
| E1.5 Invitaciones | Crear, enviar/capturar localmente, aceptar, reenviar y revocar invitaciones | Coincidencia de correo, token único/hasheado, expiración, aceptación atómica e idempotente | Token alterado/usado/revocado/vencido, correo distinto, carreras de doble aceptación, reenvío | Flujo completo para incorporar usuarios |
| E1.6 Administración | Listar miembros, cambiar rol y retirar respetando último responsable | Dos responsables pueden transferir control; no se deja el espacio huérfano; retiro surte efecto en la siguiente solicitud | Concurrencia al degradar/retirar, autosalida, otro espacio, integrante intentando administrar | Ciclo mínimo de membresía operable |
| E1.7 Cierre local | Auditar eventos, revisar errores/secretos, ejecutar suite y documentar operación | CA-01 y escenarios RF-01/RF-02 tienen evidencia repetible; no hay secretos ni PII de prueba en repo | Suite completa, revisión de logs, prueba manual de recuperación/correo capturado | E1 implementada y probada localmente, no desplegada |
| E1.8 Preparar piloto | Solo tras autorización separada: elegir y configurar alojamiento, base/Auth y correo externo; backup y límites | Presupuesto y alertas configurados; restauración comprobada; datos autorizados | Smoke test remoto, aislamiento, envío real acotado, exportar/restaurar | Candidato de piloto; proveedores y costos siguen pendientes; no forma parte de la autorización actual |

### Evidencia de cierre de CA-01

La evidencia mínima será: salida de suite con fecha y versión, matriz de autorización ejercitada, reporte de migración limpia, recorrido E2E de invitación y recuperación, y registro de limitaciones conocidas. Un despliegue o una captura de pantalla por sí solos no cierran E1. E1.8 requiere autorización posterior porque crea servicios y puede generar cargos.

### Resultado de E1.1

Completado el 2026-09-17: repositorio Git local, aplicación Next.js mínima, configuración tipada, dependencias bloqueadas, Supabase CLI con PostgreSQL/Auth/Mailpit, red limitada a `127.0.0.1`, migración/seed base, scripts de ciclo de vida, formato/lint/tipos/unidades/build, arranque HTTP y smoke E2E.

En E1.1 no se implementaron registro/login, bootstrap, espacios, membresías, roles, invitaciones, correo de aplicación, RLS de negocio, E2 ni despliegue. La identidad se añadió después, exclusivamente en E1.2.

### Resultado de E1.2

Implementado y verificado automáticamente el 2026-09-17: Supabase Auth local con correo/contraseña, registro público bloqueado, creación operativa e interactiva de usuario de prueba, cookies SSR, validación de identidad en servidor, login, persistencia al recargar, logout, recuperación por correo capturado en Mailpit, cambio de contraseña y rechazo de token inválido o reutilizado. El SDK queda detrás del adaptador de identidad y la clave administrativa se usa solo en scripts/pruebas Node locales.

El usuario comprobó manualmente el rechazo de una contraseña incorrecta, el login correcto, el acceso protegido, la persistencia de sesión al recargar, el logout con redirección al login, la recuperación, el cambio de contraseña, el rechazo de la contraseña anterior, la aceptación de la nueva y el rechazo del enlace consumido. E1.2 queda cerrada.

No se implementaron espacios, perfiles de producto, membresías, roles, invitaciones de Stepable ni autorización por espacio. E1.2 no autoriza E1.3.

### Resultado de E1.3

Implementado y verificado automáticamente el 2026-09-17: migración incremental para perfiles, espacios y membresías; roles cerrados por espacio; primer responsable obligatorio; comando privado para una identidad existente; transacción idempotente y serializada por `slug`; lista y detalle filtrados por membresía; estado vacío sin espacios.

La migración se aplicó sin reset y conservó la identidad Auth existente. Las pruebas reales cubren vínculo perfil/identidad, restricciones, atomicidad, repetición concurrente, conflictos, identidad inexistente, manipulación de UUID y estado vacío. El 2026-09-18 el usuario confirmó que realizó la comprobación manual de E1.3 y funcionó correctamente. E1.3 queda cerrada y no autoriza E1.4.

### Resultado de E1.4

Implementado y verificado automáticamente el 2026-09-18: política central con acciones explícitas para consultar espacios, gestionar invitaciones y gestionar miembros; denegación predeterminada; membresías activas/revocadas; listado y detalle autorizados desde identidad servidor y estado vigente en PostgreSQL.

La migración incremental convirtió las membresías existentes en activas, ajustó el último responsable para contar solo responsables activos y se aplicó sin reset. Los fixtures controlados cubren matriz rol × acción, rol/acción desconocidos, ausencia, revocación, cambio de rol en la siguiente consulta, aislamiento, 404, sesión global conservada, otro espacio todavía accesible, último responsable activo y bootstrap que no reactiva. No existen endpoints o interfaces de invitación/administración.

El usuario comprobó manualmente que su espacio continúa en el listado, puede abrirlo y conserva el rol `responsable`. No se atribuyen a esta comprobación otros escenarios. E1.4 queda cerrada y no autoriza E1.5.
