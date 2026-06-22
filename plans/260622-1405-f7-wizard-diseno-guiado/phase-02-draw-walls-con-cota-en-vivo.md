---
phase: 2
title: Draw Walls con cota en vivo
status: completed
effort: ''
---

# Phase 2: Draw Walls con cota en vivo

## Overview

**NÚCLEO de F7** (lo que más valora el usuario). Herramienta para dibujar muros como líneas
rectas: clic inicio → mover (preview del muro + su longitud en metros en vivo) → clic fin =
muro creado. Encadenable (el fin de uno es el inicio del siguiente) hasta cerrar el polígono.

## ⚠️ Prerrequisito BLOQUEANTE (red-team #1, Critical): alinear el pivote de rotación 2D↔3D
Antes de dar muros rotados por buenos: hoy Konva rota el objeto sobre su ESQUINA
(`structure-layer.tsx:82-89`: `<Group x={o.x} y={o.y} rotation>` sin `offsetX/Y`) y `docToScene`
posiciona/rota sobre el CENTRO del AABB (`doc-to-scene.ts:184-186` y `:281-286`). Un muro con
`rotation≠0` cae en distinto sitio en 2D y 3D. **Decidir y fijar un único contrato de pivote** (opción
A: que `segmentToWall` produzca x/y/width/height/rotation coherentes con el pivote-centro de docToScene;
opción B: corregir docToScene/structure-layer para usar el mismo origen) **y añadir un test que afirme
que un muro a 90° cae en el mismo punto físico en 2D y 3D.** Sin esto, "los muros se ven en 3D a escala
correcta" es falso para todo muro no axis-aligned.

## Architecture
- Nueva `Tool = 'draw-wall'` en el patrón existente (canvas-toolbar.tsx:18 + botón en toolbar).
  **Draw Walls REEMPLAZA el botón "Muro" de la paleta** (red-team #5): hoy `wall` se crea por clic en
  la paleta como rectángulo axis-aligned (object-palette.tsx + canvas-stage.tsx:150-170); no debe haber
  dos formas de crear 'wall' con semánticas distintas. Migrar el botón "Muro" a la herramienta de dibujo.
- Hook `use-draw-wall.ts`: maneja pointer down/move/up sobre el Stage. **Usa
  `getRelativePointerPosition()` (el `worldPointer` de canvas-stage.tsx:120), NO `getPointerPosition()`
  de use-freehand** (red-team #2, Critical): freehand puede usar coords de pantalla porque sus strokes
  no se miden ni van a 3D; un muro SÍ se mide y va a 3D, así que necesita coordenadas de DOCUMENTO
  (deshace zoom/pan). Estado: punto de inicio + posición del cursor en mundo.
- **Preview en vivo**: overlay Konva con la línea del muro en curso + su longitud real
  (`pxToMeters(distancia, scale)` con `formatLength`). Reusa `scale.ts`.
- **Crear el muro**: `segmentToWall(p1, p2, scale, grosorM)` → `StructObj` 'wall' (lógica PURA, testeable).
  **Rechaza segmentos degenerados** (longitud < umbral, p. ej. < grid o < 0,05 m) para evitar muros de
  width 0 (red-team #9). El contrato de rotación respeta el pivote unificado del prerrequisito.
- **Encadenado**: el fin queda como inicio del siguiente. **Cancelación (Esc/clic-derecho):** descarta
  SOLO el segmento en curso; los muros confirmados se conservan. La cadena se agrupa en UNA transacción
  de historial (usar `insertObjects` por cadena, no `addObject` por muro) para que un undo deshaga la
  sala entera (red-team Failure Mode #5).
- Render 3D: con el pivote ya alineado (prerrequisito), `docToScene` extruye el 'wall' en la posición
  correcta.

## Related Code Files
- Create: `src/canvas/draw-wall.ts` (lógica pura: dos puntos → StructObj wall; ángulo, longitud).
- Create: `src/canvas/use-draw-wall.ts` (hook de interacción Konva).
- Create: `tests/canvas/draw-wall.test.ts`.
- Modify: `src/components/canvas/canvas-toolbar.tsx` (Tool + botón "Dibujar muro").
- Modify: `src/components/canvas/canvas-stage.tsx` (cablear el hook cuando tool==='draw-wall').
- Reference: `src/canvas/use-freehand.ts` (patrón), `src/canvas/scale.ts`, `src/canvas/canvas-store.ts`.

## Implementation Steps
1. `draw-wall.ts`: `segmentToWall(p1, p2, scale, wallThicknessM)` → StructObj (width=dist, height=grosor px,
   rotation= atan2 en grados, x/y de la esquina). Tests de longitud, ángulo (0/90/45°), grosor.
2. `use-draw-wall.ts`: gestiona inicio/preview/fin + encadenado + Esc para terminar.
3. Toolbar: añadir Tool 'draw-wall' con su botón.
4. Stage: render del preview (línea + cota viva) y commit del muro al store.
5. Verificar en navegador: dibujar 3-4 muros encadenados, ver la cota mientras arrastras, y que en
   3D salen como paredes a escala.

## Success Criteria
- [x] `segmentToWall` puro y testeado (longitud, ángulo, grosor).
- [x] Se dibujan muros por línea con cota en vivo; encadenado; Esc termina.
- [x] Los muros dibujados aparecen en 3D a escala correcta.
- [x] tsc + eslint + vitest verdes; sin romper las otras herramientas (select/pan/freehand).

## Risk Assessment
- Coordenadas con zoom/pan: usar `getRelativePointerPosition()` (`worldPointer`, canvas-stage.tsx:120),
  NO `getPointerPosition()` — este último da coords de PANTALLA y haría que la cota y el muro mintieran
  con zoom≠1 (red-team #2).
- Pivote de rotación: ver prerrequisito bloqueante arriba; es el riesgo P0 de esta fase.
- Snap (rejilla/ángulo) se añade en la fase 3 para no mezclar responsabilidades.
