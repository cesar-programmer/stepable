# Índice y responsabilidades documentales

Estado: vigente · Actualizado: 2026-10-01.

| Documento | Fuente canónica de | Cuándo consultarlo |
| --- | --- | --- |
| [01-producto](01-producto.md) | Problema, usuarios, visión y vocabulario | Antes de decisiones de producto |
| [02-alcance-v0](02-alcance-v0.md) | Funciones incluidas y exclusiones | Antes de agregar funciones |
| [03-flujos-y-reglas](03-flujos-y-reglas.md) | Comportamiento y reglas | Al diseñar pantallas o casos de uso |
| [04-arquitectura](04-arquitectura.md) | Diseño técnico y cuestiones por resolver | Antes de implementar |
| [05-datos-y-permisos](05-datos-y-permisos.md) | Modelo conceptual y acceso | Antes de persistencia o autorización |
| [06-ia-y-evaluacion](06-ia-y-evaluacion.md) | Comportamiento de IA y su evaluación | Al diseñar recuperación y generación |
| [07-entregas-y-aceptacion](07-entregas-y-aceptacion.md) | Orden de trabajo y evidencia de cierre | Al planear una entrega |
| [08-pendientes](08-pendientes.md) | Preguntas abiertas | Antes de decidir sobre un vacío |
| [09-estado-actual](09-estado-actual.md) | Punto de reanudación | Al iniciar y cerrar una sesión |
| [10-cambios](10-cambios.md) | Historial documental breve | Para conocer qué cambió |
| [Decisiones](decisiones/README.md) | Motivos e historial de decisiones significativas | Cuando cambie una decisión |
| [Referencias](referencias/README.md) | Procedencia y límites de los PDF históricos | Para investigar antecedentes |

## Orden de planificación

Producto y alcance → flujos y reglas → datos y permisos → arquitectura e IA → entregas ejecutables → implementación.

El orden numérico sirve para encontrar documentos; las dependencias de trabajo están en el documento 07. La arquitectura vigente registra organización, stack, identidad, espacios, autorización, invitaciones, administración y auditoría local. E1 queda cerrada localmente tras la revisión de E1.7 del 2026-10-01; E2.1 (fuentes Markdown) está cerrada localmente según ADR-004 y E2.2 (PDF) está autorizada; el piloto sigue pendiente y fuera del alcance actual.

## Mantenimiento

Cada archivo declara su estado. Una decisión significativa se explica en ADR y se refleja en la especificación correspondiente. El estado actual enlaza esas fuentes sin redefinirlas. Si aparecen contradicciones, registrarlas y resolverlas antes de implementar el comportamiento afectado.
