# Fase 1 — Núcleo de snap puro: candidatos + enganche + guías

## Contexto
- `WorldRect = {x,y,width,height}` (floating-menu-anchor.ts). `rangesOverlap` (live-dimensions.ts).
- `snap(v)=round(v/20)*20`, GRID=20 (grid-layer.ts).

## Requisitos
Lógica PURA (sin React/Konva), testeable: dado el AABB del objeto en movimiento, una lista
de AABB candidatos (otros objetos) y un umbral en px, calcular el desplazamiento que engancha
y las guías a dibujar.

## Archivos a crear
- `src/canvas/snap.ts`:
  - `interface SnapResult { dx: number; dy: number; guidesX: number[]; guidesY: number[] }`
    (dx/dy = corrección a aplicar a la posición; guías = coords de mundo de las líneas).
  - `computeSnap(moving: WorldRect, candidates: WorldRect[], threshold: number): SnapResult`:
    para el eje X considera enganches a: borde izq con izq/der/centro de candidatos, ídem
    der y centro; análogo en Y. Elige el enganche de menor distancia bajo `threshold` por eje.
    Si ninguno engancha en un eje, dx/dy = 0 en ese eje (cae a la rejilla en el caller).
  - Solo candidatos cuya proyección en el OTRO eje se solapa (reusar `rangesOverlap`) cuentan
    para alineación de bordes, salvo "alineación de centros/bordes globales" (decisión: empezar
    solo con candidatos solapados en el eje perpendicular, como neighborGaps).
- `SNAP_THRESHOLD_PX = 8` exportada.

## Tests
- `tests/canvas/snap.test.ts`:
  - Engancha borde izq de moving al borde der de un candidato a 5 px (dx corrige a 0 de gap).
  - Alinea centros cuando están a < umbral.
  - No engancha si la distancia > umbral.
  - Devuelve las guías correctas (coords de las líneas de alineación).
  - Sin candidatos solapados → no engancha.

## Validación
- `bunx vitest run tests/canvas/snap.test.ts` verde; `bunx tsc` limpio.
