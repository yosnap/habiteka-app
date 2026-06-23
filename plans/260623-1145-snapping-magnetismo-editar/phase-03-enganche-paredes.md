# Fase 3 — Enganche a paredes de la sala

## Contexto
- Las paredes son objetos `kind:'wall'` en `doc.objects` (AABB axis-aligned, salvo muros
  dibujados a mano que pueden rotar). `selectionAabb` da su AABB respetando rotación.
- Fase 1: `computeSnap` ya engancha a AABB candidatos. Fase 2: aplica en vivo.

## Requisitos
Al arrastrar un mueble cerca de una pared, que se pegue a la CARA INTERIOR de la pared
(no al eje), como en Planner5D. Es lo que el usuario pidió ("engancharlo a las paredes").

## Enfoque
- Incluir las paredes como candidatos de snap, pero el enganche relevante de un mueble a una
  pared es a su CARA INTERIOR: para una pared (caja fina) el borde interior es el lado que da
  al interior de la sala. Derivar la(s) cara(s) interior(es) de cada muro (el lado más cercano
  al centro del contorno) y ofrecer ese borde como línea de enganche.
- Umbral algo mayor para paredes (el mueble debe "querer" pegarse): configurable.
- Reusar el polígono del suelo (`doc.floorOutline`) cuando exista (formas L/U/T) para conocer
  el interior; si no, el bbox de muros (rect).

## Archivos a modificar
- `src/canvas/snap.ts`: aceptar candidatos "pared" con su borde interior, o una función
  `wallSnapEdges(doc): {x:number[]; y:number[]}` que extraiga las líneas interiores.
- `structure-layer.tsx`: pasar las paredes/edges como candidatos adicionales en el drag.

## Tests / validación
- `tests/canvas/snap.test.ts`: una pared vertical a la izquierda → el borde izq del mueble
  se engancha a la cara interior. Verificación en navegador: arrastrar cama hacia pared.
- `bunx tsc` + `eslint` limpios; suite verde.
