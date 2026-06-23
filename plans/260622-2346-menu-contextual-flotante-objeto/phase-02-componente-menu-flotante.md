# Fase 2 — Componente del menú flotante (UI) integrado en el stage

## Contexto
- `CanvasStage` (`src/components/canvas/canvas-stage.tsx`) tiene `view` (zoom/pan) y `stageRef`.
- Acciones del store: `duplicateObjects` / `rotate90` / `flipSelection` / `removeObjects`
  (`src/canvas/canvas-store.ts`). Selección en `doc.selection` (`type:'object'`).
- Helper de anclaje de la Fase 1: `src/canvas/floating-menu-anchor.ts`.
- Patrón de menú HTML existente: `src/components/canvas/context-menu.tsx` (NO modificarlo).
- Regla del proyecto: nada de `useEffect` directo → usar `useMountEffect` solo para listeners;
  la posición es estado DERIVADO del render.

## Requisitos
Barra horizontal de iconos que aparece sobre el objeto seleccionado, sigue al objeto con zoom/pan
y al editarlo, y dispara las acciones reusando el store.

## Archivos a crear/modificar
- **Crear** `src/components/canvas/floating-object-menu.tsx`:
  - Props: `screenX`, `screenY`, `placement`, `ids: string[]`.
  - Botones-icono: Duplicar, Girar 90°, Voltear, Eliminar — cada uno con `title` + `aria-label`.
    Reusar `useCanvasStore.getState()` para llamar a las acciones (como hace `buildMenuItems`).
  - Estilo coherente con `context-menu.tsx` (tokens `bg-surface`, `border-line`, sombra float),
    pero en disposición horizontal de iconos. Usar iconos del set ya usado en el proyecto
    (revisar `canvas-toolbar.tsx`/`object-palette.tsx` para no introducir una librería nueva).
  - `onPointerDown` con `stopPropagation` para no deseleccionar al pulsar el menú.
- **Modificar** `src/components/canvas/canvas-stage.tsx`:
  - Leer la selección del store (objetos) y, con `view` + la geometría, derivar el anclaje
    (`selectionAabb` → `anchorPosition`). El menú se renderiza como overlay HTML POSICIONADO sobre
    el contenedor del stage (hermano del `<Stage>`, dentro del mismo contenedor relativo) usando
    `screenX/screenY` relativos al contenedor.
  - Mostrar solo cuando `selection.type==='object'` y `objectIds.length>0` y la herramienta lo
    permita (no en medio de un dibujo de muro/zona). Ocultar al deseleccionar.
  - La posición se recalcula en cada render (zoom/pan/move cambian `view` o la geometría → re-render).
  - **Ocultar durante drag/pan ACTIVO** (predict): un flag local `dragging` (true en
    `onPointerDown` sobre objeto / pan, false en `onPointerUp`/`onDragEnd`) suprime el menú; al
    soltar reaparece reposicionado. Evita recálculo del AABB en cada `onPointerMove`.
  - **Escape** desde el menú deselecciona (`setSelection(null)`), coherente con el clic derecho.
  - **Clamp** contra el área del canvas evitando solapar los controles de zoom/toolbar flotantes.

## Notas de integración
- El contenedor del canvas en `canvas-workspace.tsx:303` tiene `overflow-hidden` y es el ancestro
  posicionado. Si el overlay HTML se renderiza dentro de `CanvasStage`, asegurar que `CanvasStage`
  esté dentro de un wrapper `relative` (lo está vía el contenedor del workspace; confirmar y, si
  hace falta, envolver el `<Stage>` + overlay en un `div relative h-full w-full`).
- No usar `position: fixed` con `clientX` (eso es del clic derecho): aquí es `absolute` relativo al
  contenedor del canvas para que el clamp use el área del lienzo.

## Validación
- `bunx tsc` + eslint limpios.
- Render manual en `/dev` o la ruta del editor: seleccionar objeto → menú visible y anclado.
