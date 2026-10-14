# Interfaz: criterios visuales

Estado: rediseño en curso. Primera entrega (marco, espacios e inicio) del 2026-10-06; Rutas y acceso del 2026-10-13, pendientes de la revisión visual del usuario. Base en `src/app/styles.css` (tokens al inicio del archivo).

## Criterios

- **Tono:** onboarding profesional, cercano y dinámico. Sin gamificación: no hay puntos, rachas ni rankings. Solo se muestran datos reales del servidor.
- **Color:** azul de marca (`--brand-*`) para acciones y ubicación, verde para el progreso y los resultados correctos, ámbar para advertencias y rojo solo para errores y acciones destructivas. Neutros con contraste de texto de al menos 4,5:1.
- **Tipografía:** fuente del sistema. Escala de `--text-xs` a `--text-2xl`; el `h1` de página mide 1,75 rem. Párrafos con una anchura máxima de lectura de unos 46 rem.
- **Espaciado y anchura:** escala `--space-*`. El contenido ocupa hasta 72 rem junto a una barra lateral de 16,5 rem. Las tarjetas y las rejillas (`.grid`, `.stats`) aprovechan el ancho.
- **Botones:** primario (`button`, `.button`) para la acción principal; `secondary`, `ghost` y `danger` para el resto, con `small` como tamaño reducido. Una sola acción primaria por bloque.
- **Componentes:** `.card`, `.card-link`, `.badge` (por tono), `.notice`, `.error`, `.callout`, `.empty-state` (qué pasa y qué hacer), `.progress`, tablas con cabecera discreta y `fieldset`.
- **Iconos:** `src/app/components/icons.tsx`, un conjunto propio de trazo de 2 px. Son decorativos y siempre van con texto; un icono solo necesita `label`.
- **Accesibilidad:** foco visible (`:focus-visible`), enlace “Saltar al contenido”, `aria-current` en la navegación, menú móvil con `aria-expanded` y cierre con Escape. Las animaciones son breves (140–220 ms), no bloquean acciones y se desactivan con `prefers-reduced-motion`.
- **Tema:** claro, oscuro o del sistema (sección “Tema oscuro”).
- **Confirmaciones:** diálogo propio (sección “Tema oscuro”).
- **Movimiento:** sistema compartido (sección “Sistema de movimiento”, [ADR-012](decisiones/ADR-012-sistema-de-movimiento.md)).
- **Estados de carga:** `SubmitButton` y `ConfirmSubmitButton` reflejan el envío real (`useFormStatus`). Nunca se simulan porcentajes.
- **Estructura:** el layout `spaces/[spaceId]/layout.tsx` muestra la barra lateral (un cajón en móvil) con el espacio actual, el cambio de espacio, la navegación por rol y la administración agrupada. La autorización sigue en cada página. Las acciones que cambian roles invalidan el layout para que el menú no quede desactualizado.

## Vistas

| Vista | Estado |
| --- | --- |
| Listado de espacios, inicio del espacio (por rol), configuración | Rediseñadas |
| Rutas: listado con filtros, “Crear ruta” en su propia página y editor por pasos | Rediseñadas |
| Portada, inicio de sesión, recuperación y nueva contraseña | Rediseñadas (marco de acceso compartido) |
| Recorrido de una ruta (inicio, paso, resultado, ayuda y final) | Rediseñado (2026-10-13) |
| Asistente (consulta, respuesta con citas y estados) | Rediseñado (2026-10-13) |
| Asistente flotante y ayuda del paso en panel | Añadido (2026-10-13) |
| Fuentes, miembros, invitaciones, progreso del equipo, aceptación de invitación | Dentro del marco nuevo y con estilos base; falta el rediseño en profundidad |

## Pendiente para continuar con coherencia

- En las vistas internas, sustituir los botones “Volver a …” por la navegación del marco y agrupar cada acción primaria.
- Fuentes: listado primero y carga tras un botón; selector de archivo propio en español y límites como ayuda bajo el campo.
- Miembros: agrupar “Guardar rol” y “Retirar acceso”, con menos peso visual. Hipótesis por comprobar con usuarios: que alguien cambie el selector de rol y no lo guarde.
- Tablas de miembros, invitaciones y progreso: pasar a `.card` con acciones agrupadas.

## Rutas (2026-10-13)

- **Listado:** filas con estado legible (`routeState`) y una acción según el estado y el rol; filtros Todas, Publicadas y Borradores; sin título, el objetivo se recorta solo visualmente.
- **Crear ruta** (`/routes/new`): tres secciones (objetivo, fuentes con “X de 5” y tarjetas de actividad) y un resumen fijo con los intentos que quedan. El aviso de código es orientativo. Los errores vuelven al formulario sin perder lo escrito.
- **Editor** (`route-editor.tsx`):
  - índice de pasos, o selector en móvil, y un paso a la vez con tres secciones;
  - solo los campos de la actividad;
  - la respuesta correcta se marca junto a su opción, y las variantes van en una lista con Añadir y Quitar;
  - cambios sin guardar visibles, diálogo al cambiar de paso, borradores por paso y aviso de lo que no se guardará al cambiar de actividad;
  - vista previa sin respuestas ni progreso.

  Guardar devuelve el resultado a la página (`saveStepFormAction`) y refresca la versión de edición.

## Acceso (2026-10-13)

- **Marco de acceso** (`auth-layout.tsx`): panel de marca con tres ventajas reales del producto y una columna de formulario; en móvil, apilado y sin la lista de ventajas.
- **Formularios:** contraseña con Mostrar/Ocultar (`password-input.tsx`), enlace de recuperación junto a la etiqueta, mensajes con icono y botón de envío con estado de carga.
- **Textos:** sin la jerga técnica anterior (“Identidad local”). Mailpit solo se menciona en el aviso de recuperación, como dato del entorno local.
- **Destino:** tras entrar se llega a “Tus espacios”; `/protected` redirige allí para no romper enlaces antiguos.

## Diagnóstico del 2026-10-13 (pantallas reales con datos sintéticos)

Problemas observados, de mayor a menor impacto:

1. **Recorrido de la ruta:** todos los pasos en una página larga, con la lección completa y un formulario de ayuda abierto en cada paso. La actividad actual quedaba escondida y en móvil la página desbordaba horizontalmente. **Resuelto.**
2. **Retroalimentación y progreso del recorrido:** resumen con estilo de éxito aunque estuviera en curso, intentos solo en la leyenda, respuestas como “A” sin texto y sin siguiente acción al resolver. **Resuelto.**
3. **Asistente:** detalles técnicos del proveedor en el centro, sin ejemplos y con fragmentos en Markdown en bruto. **Resuelto.**
4. **Fuentes:** la carga domina la página y el selector de archivo nativo aparece en inglés. **Pendiente.**
5. **Miembros:** un botón primario y otro destructivo en cada fila, y el rol repetido. **Pendiente.**

## Recorrido de la ruta (2026-10-13)

Patrones adoptados, reutilizables en otras vistas:

- **Un paso a la vez:** índice con estado escrito e icono (no solo color); los pasos bloqueados no son enlaces. En móvil el índice se pliega (`details`). Se navega con `?paso=`, la misma URL a la que vuelve la respuesta.
- **Progreso:** barra segmentada por pasos con su texto (`learning-summary`), sin porcentajes.
- **Actividad:** pregunta destacada, intentos con puntos y texto, opciones como tarjetas táctiles con el radio visible y la letra, y el botón “Comprobar respuesta” con estado de envío.
- **Resultado:** panel `feedback` (correcto o incorrecto, con icono y texto) con la respuesta correcta o la solución, la explicación, las respuestas propias con su texto y una sola acción siguiente (“Siguiente paso” o “Ver el resumen”).
- **Ayuda:** panel plegado “¿Necesitas ayuda con este paso? No consume intentos de respuesta.”, con un ejemplo de duda, la advertencia honesta de que la ayuda puede dejar ver la respuesta y el aviso de que cada consulta usa IA y cuenta en el límite diario.
- **Inicio y final:** antes de empezar, reglas y lista de pasos; al terminar, aciertos frente a pasos resueltos y el recordatorio de que completar no implica dominar.

El índice existe dos veces en el DOM (escritorio y móvil plegado). Comprobado el 2026-10-13 a 1440 y 390 px: el oculto (`display:none`) no recibe foco con Tab ni aparece en el árbol de accesibilidad.

## Asistente (2026-10-13)

- **Consulta independiente:** la cabecera dice que cada pregunta se responde por separado, sin memoria ni historial. El campo va arriba y debajo solo el último resultado; no hay hilo de mensajes.
- **Inicio:** tres ejemplos fijos que solo rellenan el campo (no envían ni consumen IA). Sin fuentes listas, estado vacío con la acción según el rol en lugar del formulario.
- **Campo:** crece con el texto, botón integrado, contador, Ctrl + Enter, validación propia en español, solo lectura y botón desactivado durante el envío real (sin doble envío ni streaming simulado).
- **Resultado:** la pregunta como bloque discreto y la respuesta en tarjeta con ancho de lectura. Las marcas `[n]` verificadas enlazan a su fuente en la lista “Fuentes citadas”; cada fuente abre su página. “Copiar respuesta” incluye las fuentes; “Editar esta pregunta” la devuelve al campo sin enviarla. Tras una respuesta el campo se vacía; tras un fallo conserva lo escrito.
- **Estados:** sin evidencia, no verificable, error del modelo, límite de consumo (`budgetMessages`), sesión y acceso, cada uno con qué pasó y qué hacer. Sin reintentos automáticos. Los fragmentos van plegados, salvo en modo solo recuperación.
- **Markdown seguro** (`components/markdown.ts`, `safe-markdown.tsx`): párrafos, encabezados, listas, código en bloque y en línea, negrita y citas. Todo se dibuja como texto React, sin HTML ni enlaces a partir del contenido. Se usa en el asistente, en sus fragmentos y en la ayuda de las lecciones; las lecciones siguen en texto plano.
- **Secundario:** el modo de conversación y embeddings, en “Detalles técnicos” plegado.

Limitaciones: con el modelo simulado la respuesta es un párrafo; listas y código se ven en los fragmentos y están cubiertos por pruebas unitarias. El límite de consumo no se puede provocar en modo simulado y no se capturó.

## Sistema de movimiento (2026-10-13)

- **Tokens** (iguales en `styles.css` y en `motionTokens`): 90 ms al pulsar; 140 ms en hover, color y salidas; 220 ms en entradas, paneles y diálogos; 320 ms en el cajón y el progreso. Curva de salida (`--ease-out`) para entrar, de entrada (`--ease-in`) para salir y muelle suave (`--ease-spring`) solo para confirmaciones pequeñas.
- **CSS:**
  - entrada breve del contenido de cada página, con el marco fijo;
  - marcador del elemento activo y aviso inmediato del enlace en curso (`LinkPending`);
  - cajón móvil con fondo que aparece y desaparece;
  - acordeones (`details`) que abren y cierran en altura;
  - diálogos que entran y salen;
  - pulsación y hover discretos solo en elementos interactivos;
  - selección de tarjetas y opciones;
  - estado de las fuentes al cambiar;
  - progreso por segmentos;
  - icono de acierto y marca de ruta completada.
- **Motion** (`components/motion.tsx`):
  - `Presence` para contenido condicional: avisos, validación, bienvenida del asistente y archivo elegido;
  - `SwapTransition` para cambiar de estado: pasos del recorrido y del editor (con dirección), tipo de actividad, actividad o resultado, y estados del asistente. Lo nuevo entra mientras lo anterior sale encima, sin esperas;
  - `AnimatedList` para filas que se añaden, quitan o filtran: rutas, fuentes, miembros e invitaciones.
- **Garantías:**
  - nada se desmonta mientras se escribe, porque los borradores viven en el estado y no en el DOM;
  - lo que sale queda inerte y deshabilitado, sin repetir envíos;
  - si el foco estaba en el contenido que sale, pasa al nuevo;
  - sin desplazamientos automáticos;
  - con movimiento reducido todo es instantáneo.
- **Dónde probarlo:**
  - navegación entre Inicio, Rutas, Asistente y Fuentes;
  - filtros de Rutas;
  - “Crear ruta”: fuentes y “Lectura de código” sin código en las fuentes;
  - editor: cambiar de paso y de tipo, vista previa y diálogo de cambios sin guardar;
  - recorrido: fuentes de la lección, ayuda, respuesta incorrecta y correcta, siguiente paso y final;
  - asistente: ejemplo, consulta y error;
  - Fuentes: elegir un archivo;
  - en móvil: menú e índice de pasos.

Corrección incluida: con el menú móvil abierto, el fondo tapaba “Cerrar menú”; la barra queda ahora entre el fondo y el cajón. Limitaciones:
- las filas que se quitan desde el servidor se animan al llegar la página nueva, no antes;
- en los navegadores que no admiten `::details-content`, los acordeones abren sin animar la altura. Solo se verificó en Chromium.

## Asistente flotante (2026-10-13)

- **Acceso:** botón “Preguntar” abajo a la derecha en todas las vistas de un espacio, solo si el rol puede consultar las fuentes. No aparece fuera de un espacio, en el acceso ni en la página Asistente. Nunca se abre solo.
  - El contenido reserva espacio inferior para que el botón no tape controles.
  - En móvil se oculta mientras se escribe en otro campo.
- **Panel** (`components/assistant/dock.tsx`, con `SlideOver` del sistema de movimiento):
  - en pantallas de 64 rem o más, panel lateral de 28 rem; el contenido le deja sitio y la página sigue usable;
  - en pantallas menores, hoja modal: el resto queda inerte y la hoja se ajusta al teclado (`interactive-widget=resizes-content`);
  - cierre visible, Escape y foco al campo al abrir; al cerrar, el foco vuelve a lo que lo abrió.
- **Una sola implementación:** `ConsultForm` (formulario, estados, citas y Markdown) sirve a la página y al panel, para el espacio o para un paso.
  - `AssistantProvider`, en el marco del espacio, guarda en memoria la pregunta y el último resultado: sobreviven a cerrar el panel y a navegar dentro del espacio.
  - El estado desaparece al cambiar de espacio (proveedor por espacio) o al cerrar sesión. No usa almacenamiento ni historial, y cada consulta sigue siendo independiente.
- **Ayuda del paso:** “Pedir ayuda” abre el mismo panel en “Ayuda de este paso”, con un selector “El espacio · Este paso” y el paso indicado en la cabecera.
  - Usa la misma acción y las mismas reglas que antes: solo se envían los identificadores y la duda opcional.
  - Una respuesta queda ligada a su paso; al cambiar de paso se descarta y se vacía la duda.
- **Abrir o cerrar no consulta nada:** la prueba E2E cuenta las peticiones POST.

## Tema oscuro, confirmaciones y borradores (2026-10-13)

- **Tema:** los mismos tokens invertidos en `styles.css`.
  - Sigue `prefers-color-scheme` salvo que la persona elija otro en el selector “Sistema · Claro · Oscuro”, que está en la barra lateral, la cabecera de “Tus espacios” y las pantallas de acceso.
  - La elección es una preferencia del dispositivo: la cookie `stepable-tema`, que el layout raíz lee para pintar sin destello del otro tema.
  - Tokens semánticos nuevos: `--accent` y `--on-accent` (rellenos con texto encima), `--danger-fill`, `--overlay` y los tonos `-200` y `--warning-500`. Los paneles de marca y los bloques de código son oscuros en ambos temas.
  - Revisado con capturas de todas las vistas en oscuro; ninguna desborda.
- **Confirmaciones:** `ConfirmSubmitButton` ya no usa `window.confirm`.
  - Abre un diálogo propio con la pregunta como título, un botón con el verbo concreto (“Eliminar fuente”, “Publicar”, “Retirar acceso”…) y “Cancelar”, que recibe el foco por defecto y lo devuelve al botón al cerrar.
  - Sigue el tema y la animación de diálogos, y envía con el mismo botón como emisor.
- **Borradores (RN-40):** “Eliminar” en las tarjetas de Inicio y en las filas de Rutas, y “Eliminar borrador” en la cabecera del borrador.
  - El disparador es discreto (texto rojo) y el diálogo lleva el botón rojo.
  - Mientras se genera, el botón está desactivado con la explicación.
  - En Inicio, la tarjeta entera sigue abriendo el borrador mediante el enlace del título, y sus acciones quedan por encima.
- **Pendiente:** otras carencias de gestión, listadas como PEN-13 en el documento 08.
