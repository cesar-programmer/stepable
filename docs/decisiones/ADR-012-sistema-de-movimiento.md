# ADR-012 · Sistema de movimiento de la interfaz

- **Fecha:** 2026-10-13
- **Estado:** propuesto (pendiente de la revisión visual del usuario)

## Contexto

El usuario pidió transiciones coherentes en toda la aplicación y, después, una biblioteca de animación para los cambios de estado complejos, combinada con CSS para lo sencillo. Autorizó la instalación. Antes había unas quince animaciones `enter` sueltas en CSS y ninguna salida animada.

## Alternativas

1. **Solo CSS** (`@starting-style`, `::details-content`, transiciones discretas). No añade peso, pero las salidas de contenido condicional, el intercambio de estados y las listas filtradas exigen código propio para mantener montado lo que sale.
2. **Motion** (`motion`, antes Framer Motion). Ofrece salidas (`AnimatePresence`), animaciones de posición (`layout`), carga diferida (`LazyMotion`, unos 4,6 KB iniciales) y `MotionConfig reducedMotion`. Su paquete declara compatibilidad con React 18 y 19 (`peerDependencies`) y se usa en componentes de cliente desde `motion/react`.
3. **API View Transitions con React o Next.js.** En Next.js 16 sigue siendo experimental, así que se descarta para no depender de una opción inestable.

## Decisión

- Motion `13.4.6` con versión fijada. Sus paquetes internos (`framer-motion` 13.4.6, `motion-dom` 13.4.5 y `motion-utils` 13.3.0) se fijan con `overrides` en `pnpm-workspace.yaml`, porque sus rangos `^` habrían arrastrado la serie 13.5.
  - Se descartan la 14.x (versión mayor del 2026-10-02, con parches del mismo 2026-10-13) y la 13.5 (cambios internos revertidos en parte).
  - La 13.4.7 figura en el registro de cambios, pero no se publicó en npm.
- **Reparto:** CSS para hover, pulsación, acordeones, diálogos, cajón móvil, entrada de página y marcador activo. Motion solo para los componentes compartidos de `src/app/components/motion.tsx`: `Presence`, `SwapTransition`, `AnimatedList`/`AnimatedItem` y `MotionProvider`. Las pantallas no definen tiempos propios.
- **Mismos tokens en CSS y TypeScript:** 90, 140, 220 y 320 ms, y curvas de entrada, salida y muelle suave.

## Consecuencias

- Dependencia nueva en el cliente. Sus funciones se cargan después del primer render.
- **Contenido que sale:** durante la salida sigue en el DOM unos 140 ms, inerte, oculto para la accesibilidad y con sus controles deshabilitados. Las pruebas que cambian de paso o de tipo de actividad esperan a que termine (`[data-exiting]`).
- **Movimiento reducido:** las salidas y los desplazamientos son instantáneos.
- Actualizar Motion es una decisión explícita: hay que revisar su registro de cambios y los `overrides`.

## Documentos afectados

`docs/11-interfaz.md` (sistema de movimiento), `package.json`, `pnpm-workspace.yaml` y `pnpm-lock.yaml`.
