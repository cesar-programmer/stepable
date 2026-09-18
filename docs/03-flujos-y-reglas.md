# Flujos y reglas

Estado: reglas base del alcance; identidad y acceso por espacio implementados hasta E1.3, flujos posteriores propuestos.
Actualizado: 2026-09-17.

## Flujos principales

### F-01 Preparar conocimiento

Durante la V0, el operador aprovisiona el espacio y designa su primer responsable según RN-10. El responsable agrega una fuente y ve su procesamiento. Si falla, recibe un error comprensible y puede reintentar. Solo contenido listo se utiliza para responder o generar rutas. Reemplazar una fuente conserva su identidad y registra una versión; política de selección pendiente PEN-04.

### F-02 Crear onboarding

Responsable establece objetivo, selecciona fuentes y tipos de actividades. La generación crea un borrador. Revisa explicaciones, citas y criterios de respuesta; edita y publica. Un error de generación debe permitir recuperarse sin publicar contenido incompleto.

### F-03 Aprender

Integrante accede a una ruta publicada, completa pasos, responde actividades y recibe retroalimentación. Puede consultar al asistente con contexto del paso. Al volver, retoma su progreso en la misma versión. Aprobación, reintentos y desbloqueo pendientes PEN-03.

### F-04 Consultar

Integrante pregunta en el contexto de un espacio. El sistema comprueba acceso, recupera evidencia y responde con citas o comunica insuficiencia. Acceder desde una lección añade contexto; no habilita fuentes ajenas al espacio.

## Reglas base

| ID | Regla |
| --- | --- |
| RN-01 | Ningún contenido generado se publica automáticamente |
| RN-02 | La respuesta sobre una regla interna requiere evidencia que respalde la afirmación |
| RN-03 | Toda lectura o escritura debe respetar pertenencia al espacio y rol |
| RN-04 | Chats personales privados; responsables acceden a avance y resultados, no a esos chats |
| RN-05 | Una ruta publicada se modifica creando otra versión; el progreso conserva la versión cursada |
| RN-06 | Cambios de fuente señalan rutas afectadas para revisión; no reescriben lecciones publicadas |
| RN-07 | Aprobación de actividades basada en criterios definidos; opinión libre de IA no implica aprobación |

## Casos por especificar

Fuentes contradictorias, eliminación de fuentes citadas, ruta obsoleta y doble envío de respuestas siguen abiertos. E1.3 ya comprueba membresía vigente al listar y abrir espacios; la autorización completa, retiro y cambios de rol conservan las partes pendientes de RN-11/RN-16/RN-17 en [datos y permisos](05-datos-y-permisos.md). Ver PEN-03 a PEN-06.
