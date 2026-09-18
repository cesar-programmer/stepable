# Datos y permisos

Estado: identidad local y modelo de espacios/membresías aceptados e implementados hasta E1.3; autorización completa e invitaciones pendientes.
Actualizado: 2026-09-17.

## Conceptos y relaciones

| Concepto | Relación a preservar |
| --- | --- |
| Usuario y membresía | Usuario pertenece a espacio con un rol |
| Fuente y versión | Fuente pertenece a espacio; versión identifica contenido concreto |
| Fragmento y cita | Fragmento pertenece a versión; cita apunta a fragmento y ubicación |
| Ruta y versión | Ruta pertenece a espacio; versión reúne pasos y referencias |
| Actividad | Tiene tipo, contenido y criterios de evaluación |
| Progreso e intento | Pertenecen a usuario y versión de ruta/actividad |
| Hilo y mensaje | Pertenecen a usuario y espacio; contexto opcional de lección |
| Proceso | Registra estado y resultado de ingesta o generación |

## Matriz funcional inicial

| Acción | Responsable | Integrante |
| --- | --- | --- |
| Administrar fuentes y miembros del espacio | Sí | No |
| Crear, editar y publicar rutas | Sí | No |
| Recorrer rutas publicadas y consultar fuentes del espacio | Sí | Sí |
| Consultar al asistente | Sí | Sí |
| Ver progreso propio | Sí | Sí |
| Ver progreso y resultados del equipo | Sí | No |
| Ver conversaciones personales de otro usuario | No | No |

Responsable que prueba una ruta y acceso al documento completo son concreciones propuestas. Validar la matriz en PEN-05 antes de implementar. No existe permiso por documento en esta propuesta; validar que las fuentes sean compartibles con todos los miembros autorizados del espacio.

## Cuestiones del modelo conceptual

- Retiro, cambio de rol y transferencia tienen política propuesta en RN-11/RN-12/RN-17; falta aprobación y diseño físico de concurrencia.
- Qué ocurre con referencias históricas al borrar una fuente.
- Qué versión puede consultar un asistente cuando una ruta usa contenido anterior.
- Retención de conversaciones, intentos y archivos; acceso operativo y tratamiento por proveedores.
- Límites de archivo y políticas de versiones/deduplicación.

Las reglas de negocio están en [03](03-flujos-y-reglas.md); este documento no redefine su comportamiento.

## Consecuencias técnicas propuestas en arquitectura v0.5

El [documento 04](04-arquitectura.md) propone separar propiedad de datos por módulo, mantener el índice reconstruible y persistir trabajos recuperables. También propone detección de conflictos al editar y registro coherente de intento/progreso. No cambia la matriz de permisos ni cierra PEN-03, PEN-04, PEN-05 o PEN-06.

## Política mínima propuesta para E1

Esta sección es la definición normativa de acceso e invitaciones. ADR-003 acepta la porción local de RN-08 y, para E1.3, RN-09, RN-10 y el principio de RN-12. RN-11 está aceptada solo para las consultas de espacio implementadas. Invitaciones, administración y revocación siguen pendientes en PEN-02/PEN-05.

### Identidad y espacios

| ID | Regla propuesta |
| --- | --- |
| RN-08 | El acceso a la aplicación es solo por invitación. No hay registro público ni acceso anónimo. La autenticación inicial usa correo y contraseña verificados, recuperación por correo y cierre de sesión. |
| RN-09 | Una identidad puede pertenecer a varios espacios. Cada membresía activa es única por usuario y espacio y tiene exactamente un rol: `responsable` o `integrante`. |
| RN-10 | El primer responsable y el primer espacio se crean mediante un procedimiento operativo privado y auditable, sin contraseña predeterminada ni endpoint público. Durante la V0, el mismo aprovisionamiento operativo crea espacios posteriores y designa su primer responsable; después, cada responsable administra solo las invitaciones y membresías de su espacio. |
| RN-11 | Toda operación protegida vuelve a cargar desde la base la membresía activa y el rol vigentes. Un identificador de espacio, un rol en pantalla/token/caché o una sesión válida no concede por sí solo acceso. |
| RN-12 | Un espacio puede tener varios responsables y nunca puede quedar sin al menos uno. No se puede retirar ni degradar al último responsable activo. |

**Resolución parcial de RN-08 en E1.2:** se aprueban exclusivamente autenticación local con correo y contraseña, ausencia de registro público, login/logout, recuperación y establecimiento de contraseña mediante Mailpit, sesión en cookies y validación de identidad en servidor. El usuario de prueba se crea con una operación local interactiva y queda confirmado en Auth, sin credenciales versionadas. “Solo por invitación” queda como restricción de producto, pero su mecanismo, las invitaciones de Stepable y la relación con espacios no están aprobados ni implementados todavía.

**Resolución de E1.3:** RN-09 queda aceptada: una identidad puede pertenecer a varios espacios, la membresía es única por usuario/espacio y el rol pertenece al espacio. RN-10 queda aceptada con un cambio frente a la propuesta anterior: el comando privado vincula una identidad local ya existente y no crea una invitación ni una identidad. Solo el operador aprovisiona espacios durante la V0. RN-12 queda aceptada como invariante; el esquema admite varios responsables e impide confirmar un espacio sin ninguno, mientras las operaciones de administración y sus carreras se reservan para E1.6. La parte de RN-11 que obliga a consultar la membresía vigente se aplica desde ahora al listado y detalle de espacios; su matriz completa corresponde a E1.4.

### Invitaciones y cambios de membresía

| ID | Regla propuesta |
| --- | --- |
| RN-13 | Una invitación identifica espacio, correo normalizado, rol, emisor, vencimiento y estado. El rol predeterminado es `integrante`; invitar como `responsable` exige una elección explícita. |
| RN-14 | El enlace usa un token aleatorio de un solo uso; se almacena solo su hash. Caduca a los 7 días. Reenviar o revocar invalida el token anterior. Estados: `pendiente`, `aceptada`, `revocada`, `vencida`. |
| RN-15 | Para aceptar, la identidad debe tener correo verificado coincidente. La creación o reactivación de la membresía y el consumo de la invitación ocurren atómicamente. Repetir una aceptación exitosa devuelve el mismo resultado. |
| RN-16 | Un responsable puede listar miembros e invitaciones del propio espacio, revocar pendientes, cambiar roles y retirar miembros, sujeto a RN-12. No puede administrar otro espacio manipulando identificadores. |
| RN-17 | Cuando se confirma el retiro de una membresía o el cambio de rol, las solicitudes protegidas que comiencen después usan el nuevo estado aunque la sesión global siga abierta. Retirar un espacio no cierra otras membresías ni la sesión de identidad. No borra automáticamente autoría, progreso o conversaciones; su retención se resuelve en PEN-06. |
| RN-18 | Inicio de sesión, recuperación y aceptación no revelan si un correo ajeno tiene cuenta o invitación. Se aplican límites de frecuencia y respuestas externas no enumerables. |

El bootstrap es una capacidad operativa, no un rol global visible en el producto. No se propone acceso del desarrollador a conversaciones o documentos. Los eventos mínimos auditables de E1 son: creación de espacio, invitación, reenvío/revocación/aceptación, cambio de rol y retiro, con actor, espacio, objetivo y fecha; no se guardan tokens ni contraseñas.

### Consecuencias por rol

- Responsable: administra miembros e invitaciones únicamente en sus espacios, puede promover otro responsable y no puede retirar/degradar al último. Ser responsable no permite crear otro espacio durante la V0 ni concede acceso operativo global.
- Integrante: usa contenido y ve su propio progreso en los espacios donde mantiene una membresía activa; no administra miembros ni obtiene acceso por conservar una sesión después de ser retirado.
- Ambos: pueden pertenecer a varios espacios, mantienen una única sesión de identidad y pierden o cambian capacidades por espacio según el estado vigente en la base.

### Aclaraciones añadidas en v0.5

RN-08, RN-09, RN-12–RN-16 y RN-18 conservan el texto de v0.4. Esta revisión amplía tres reglas ya propuestas, sin presentarlas como aceptadas:

- RN-10 concreta quién ejecuta el bootstrap y quién crea espacios posteriores.
- RN-11 explicita que roles embebidos en tokens o cachés no son autoridad.
- RN-17 delimita la revocación por espacio, la sesión global y el momento a partir del cual aplica.

## Aprovisionamiento inicial y de espacios posteriores

### Desarrollo local

1. Iniciar la pila local de Supabase y la aplicación en la máquina del desarrollador.
2. Crear previamente la identidad con el procedimiento de E1.2. El bootstrap no crea identidades, no establece contraseñas y falla de forma comprensible si el correo no existe en Auth local.
3. Ejecutar `pnpm access:bootstrap-space` y proporcionar de forma interactiva el correo existente, un `slug` estable y el nombre visible del espacio.
4. El comando normaliza y valida los parámetros, serializa por `slug` y crea en una transacción el perfil, espacio y membresía `responsable`. Una repetición idéntica devuelve el espacio existente; el mismo `slug` con otro nombre o responsable inicial produce un conflicto y no deja datos parciales.
5. El comando se ejecuta solo desde la terminal del operador y no tiene ruta pública equivalente. Para espacios posteriores se repite el mismo procedimiento con otro `slug`.

Los datos de prueba usan dominios reservados como `example.test`; no se incluyen contraseñas, tokens o claves reales en semillas o archivos versionados.

### Piloto

Propuesta no aprobada y fuera de E1.3. Deberá revisarse antes del piloto; no modifica el bootstrap local aceptado.

1. El operador de Stepable ejecuta el mismo caso de uso como tarea puntual desde un entorno administrativo confiable. No existe botón, endpoint público ni URL secreta de bootstrap.
2. La credencial de servicio se obtiene del gestor de secretos del alojamiento/Supabase y nunca se pasa por argumentos visibles, logs o repositorio.
3. El comando muestra el destino y solicita confirmación, comprueba unicidad/idempotencia y registra actor operativo, correo, espacio y fecha sin guardar secretos.
4. Para una identidad nueva, el servicio de identidad entrega su invitación mediante el canal de correo que se apruebe para el piloto y redirige al flujo de Stepable; para una identidad existente, el adaptador de correo entrega la invitación Stepable. El destinatario verifica el correo cuando corresponda y establece su propia contraseña; nunca se comunica una contraseña del operador. Proveedor, dominio y configuración de correo externo siguen pendientes.
5. La aceptación remota ejecuta la misma transacción que en local. Si la invitación expira o se revoca, el espacio no queda utilizable sin responsable; el operador reemite la invitación.

Durante la V0, **solo el operador de Stepable** aprovisiona espacios nuevos y nombra al primer responsable. Un responsable puede administrar su espacio pero no crear otro. Esto limita abuso y evita diseñar ahora registro autoservicio, planes o administración global. El procedimiento para espacios posteriores omite únicamente la condición “cero espacios”; mantiene confirmación, auditoría e idempotencia.

## Semántica de revocación

“Inmediata” significa **efectiva para toda solicitud protegida que comience después del commit** que retira la membresía o cambia el rol. No significa cerrar automáticamente la sesión global, expulsar de otros espacios ni poder recuperar bytes que ya fueron entregados.

- El token de Auth acredita identidad y expiración de sesión; no es fuente de roles de Stepable.
- Al entrar a cada caso de uso protegido, el backend consulta la membresía activa y rol en PostgreSQL. En E1 no habrá caché de decisiones de autorización. Si después se agrega, deberá invalidarse por versión y nunca permitir acceso cuando la base diga retirado.
- La interfaz puede ocultar acciones, pero el backend repite el control. RLS es defensa adicional, no la única autoridad.
- Una operación corta que modifica datos valida y bloquea la fila de membresía dentro de su transacción. El retiro/cambio usa un bloqueo incompatible: el orden de commits decide. Si la revocación confirma primero, la acción se rechaza; si la acción ya obtuvo el bloqueo y confirma primero, puede finalizar y la revocación aplica después.
- Una lectura ya autorizada o una respuesta ya enviada no se cancela retroactivamente. Las operaciones largas futuras no mantendrán transacciones abiertas: revalidarán membresía antes de entregar o confirmar resultados. E1 no contiene trabajos largos.
- Cerrar sesión revoca la sesión de identidad en ese cliente; retirar una membresía revoca solo un espacio. Si se requiere expulsar todas las sesiones por incidente de seguridad, será una operación distinta del proveedor de Auth.

## Modelo mínimo para E1

E1.3 fija estas entidades de acceso; invitaciones y auditoría se añadirán en sus entregas:

- `profiles`, con el UUID de `auth.users` como clave primaria y referencia restringida;
- `spaces`, con UUID, `slug` único, nombre y responsable inicial;
- `memberships`, con clave primaria `(space_id, profile_id)` y enum cerrado `responsable`/`integrante`;
- invitación con correo normalizado, hash de token único, rol, vencimiento y estados terminales;
- evento de auditoría de acceso sin secretos.

Las operaciones que aceptan invitaciones, cambian roles o retiran miembros deben usar transacciones y restricciones de base. El control del último responsable no puede depender solo de ocultar un botón; requiere una estrategia transaccional probada contra concurrencia.

## Decisiones aún abiertas después de E1.3

- Aprobar el mecanismo de invitación de Stepable y su relación con identidades ya existentes o nuevas.
- Concretar en E1.6 las operaciones de cambio/retiro y su estrategia de bloqueo concurrente para proteger al último responsable; el principio y los responsables múltiples ya están aceptados.
- Confirmar si siete días es la vigencia adecuada o elegir otra antes de publicar el correo definitivo.
- PEN-06 sigue definiendo cuánto conservar membresías retiradas y auditoría. No bloquea implementar el rechazo inmediato, pero sí recibir datos reales del piloto.
