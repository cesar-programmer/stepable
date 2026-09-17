# Instrucciones de trabajo para Stepable

## Contexto

Stepable combina onboarding interactivo y consultas permanentes sobre prácticas internas. Su visión abarca distintas áreas; la V0 se enfoca en equipos de software. Lo desarrolla una sola persona con apoyo de Codex, como producto propio para validar y como portafolio.

## Inicio de cada sesión

1. Leer `docs/00-indice.md` y `docs/09-estado-actual.md`.
2. Leer `docs/02-alcance-v0.md` y las especificaciones relacionadas con la tarea.
3. Consultar `docs/decisiones/` cuando la tarea afecte decisiones registradas.
4. Si existe código, revisar el estado real del repositorio y las instrucciones locales antes de editar. No asumir que lo narrado en una sesión anterior ya se implementó.

## Autoridad y alcance

- Seguir las instrucciones vigentes del usuario y reflejar cambios de producto en los documentos.
- Usar las especificaciones vigentes como referencia. Los PDF de `docs/referencias/` son antecedentes, no mandatos de implementación.
- No convertir propuestas o preguntas pendientes en decisiones aceptadas sin registrar la resolución y su fundamento.
- Resolver detalles rutinarios dentro de la tarea autorizada. Consultar cuando una ambigüedad cambie materialmente alcance, privacidad, costos o comportamiento.
- La tarea actual es documentación y planificación. El paquete no autoriza por sí solo desarrollar o desplegar toda la aplicación.

## Forma de trabajar

- Explicar en español qué se hará, para qué y por qué. Avanzar por entregas comprensibles.
- Mantener una única definición normativa de cada regla; enlazarla desde otros documentos.
- Usar los identificadores RF, RN, CA, PEN y ADR para relacionar requisitos, reglas, aceptación, pendientes y decisiones.
- No elegir frameworks, servicios o versiones porque aparecen en los PDF históricos. Justificar decisiones técnicas y verificar documentación oficial vigente cuando corresponda.
- No registrar credenciales, información privada de empresas ni conversaciones sensibles como memoria del proyecto.
- No atribuir resultados de pruebas, validación comercial o commits que no se hayan obtenido.

## Cierre de cada entrega

1. Actualizar el documento canónico si cambió una especificación.
2. Registrar decisiones significativas en un ADR; no borrar decisiones sustituidas.
3. Actualizar `docs/09-estado-actual.md`: realizado, evidencia, pendiente y siguiente tarea concreta.
4. Agregar una entrada breve a `docs/10-cambios.md`.
5. Reportar archivos cambiados, verificación realizada y limitaciones. Mantener explícita la diferencia entre documentado, implementado y probado.

No copiar la conversación completa como estado. Registrar hechos y decisiones suficientes para continuar.
