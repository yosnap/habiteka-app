# Fase 2 — Capa de edición de vértices (handles arrastrables, ortogonal)

## Contexto
- Capas en `src/components/canvas/layers/`. `structure-layer.tsx` ya usa Group draggable +
  dragBoundFunc + cota en vivo (LiveDimensionOverlay) + snap (computeSnap). `grid-layer.ts`
  tiene `snap()` (rejilla 20). `floorOutline` = vértices del contorno (px).
- Fase 1: `setFloorOutline(vertices)`.

## Requisitos
Un modo "Editar contorno" que dibuje un handle por vértice del contorno y permita arrastrarlos,
manteniendo el contorno ORTOGONAL, con cota en vivo, regenerando muros y suelo al soltar.

## Enfoque
- Estado de modo (en el workspace o store): `editingOutline: boolean`. Un botón lo activa.
- `vertex-editor-layer.tsx`: por cada `floorOutline[i]` dibuja un `Circle` arrastrable.
  - **Ortogonalidad**: al mover el vértice `i`, sus dos aristas vecinas son axis-aligned; mover
    el vértice mueve el extremo común. Para mantener ángulos rectos, al arrastrar el vértice se
    ajustan también los vértices vecinos que comparten coordenada (el vecino que comparte X se
    mueve en X con él; el que comparte Y, en Y). Lógica PURA `moveVertexOrtho(outline, i, x, y)`
    en room-shapes (o nuevo `outline-edit.ts`), testeable.
  - Snap del handle a rejilla (reusar `snap`).
  - Cota en vivo de la(s) arista(s) afectadas (reusar overlay/medidas).
  - En `onDragEnd`: `setFloorOutline(nuevoContorno)` (Fase 1) → regenera muros + 3D + historial.
- No tocar `structure-layer` cuando el modo está activo (los muros no se arrastran sueltos en
  modo contorno, evitando el problema de romper el contorno).

## Tests
- `tests/canvas/outline-edit.test.ts`: `moveVertexOrtho` mantiene ortogonalidad (los vecinos
  que comparten coordenada se actualizan), no degenera el polígono.

## Validación
- tsc + eslint limpios; suite verde; sin `useEffect` directo.
- Verificación en navegador: mover un vértice de una L → contorno y 3D coherentes.
