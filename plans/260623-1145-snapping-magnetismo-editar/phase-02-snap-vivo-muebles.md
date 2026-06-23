# Fase 2 — Snap en vivo al mover muebles (dragBoundFunc + guías)

## Contexto
- `structure-layer.tsx`: Group `draggable`; `onDragStart:103` ya precalcula `neighborsRef`
  (AABB de vecinos). `onDragMove:112` calcula AABB actual. Overlay de cota: `LiveDimensionOverlay`.
- Fase 1 aporta `computeSnap` + `SNAP_THRESHOLD_PX`.

## Requisitos
Enganchar el objeto a bordes/centros de otros objetos MIENTRAS se arrastra, con guías
visibles, no solo al soltar.

## Enfoque
- Añadir `dragBoundFunc` al Group: recibe la posición propuesta (en coords de stage/escena),
  reconstruye el AABB del objeto en esa posición, llama `computeSnap` contra `neighborsRef`,
  y devuelve la posición corregida (pos + dx/dy). Cae a rejilla si no hay enganche.
- Guías: guardar las guías del último `computeSnap` en un ref/estado y dibujarlas en el
  overlay (líneas finas tipo CAD) durante el drag; limpiarlas en `onDragEnd`.
- `onDragEnd`: aplicar el resultado del snap (ya reflejado en la posición del nodo); mantener
  la rejilla como fallback solo si no hubo enganche.

## Archivos a modificar
- `src/components/canvas/layers/structure-layer.tsx`: `dragBoundFunc`, estado de guías.
- `src/components/canvas/layers/live-dimension-overlay.tsx` (o nuevo `snap-guides-overlay.tsx`):
  dibujar las líneas-guía de alineación.

## Tests / validación
- La lógica está en Fase 1 (pura, testeada). Aquí: verificación en navegador (mover una cama
  cerca de otra → se alinea con guía). `bunx tsc` + `eslint` limpios; suite verde.
- Regla del proyecto: sin `useEffect` directo.
