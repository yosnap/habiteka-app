# Fase 1 — Medición pura: tamaño + distancias a vecinos

## Contexto
- `scale.ts`: `pxToMeters`, `formatLength`, `formatObjectSize(o, scale)` (tamaño ya formateado),
  `isValidScale`.
- `floating-menu-anchor.ts`: `selectionAabb(objects, ids)` → AABB rotado en mundo. Reutilizable.
- `StructObj` en `src/canvas/types.ts`.

## Requisitos
Lógica PURA (sin React/Konva) para las distancias a vecinos. El tamaño NO necesita helper nuevo
(se reusa `formatObjectSize`).

## Archivos a crear/modificar
- **Crear** `src/canvas/live-dimensions.ts` (kebab-case):
  - `type NeighborGaps = { left?: number; right?: number; top?: number; bottom?: number }` (metros).
  - `neighborGaps(moving: WorldRect, others: WorldRect[], scale): NeighborGaps`
    — para el AABB `moving`, encuentra en cada eje el vecino más cercano que se SOLAPA en el otro eje
    (proyección): a la izquierda/derecha (gap horizontal), arriba/abajo (gap vertical). Devuelve la
    distancia en METROS. Si no hay vecino solapante en un lado, omite ese lado (undefined). Gaps
    negativos (solape) → 0 (mostrar 0, no negativos: una cota de hueco negativa confunde).
  - **MVP sin `roomBounds`** (recorte del predict): la distancia a paredes es mejora futura.
  - Reusar `WorldRect` de `floating-menu-anchor.ts` (exportarlo si no lo está) para no duplicar el tipo.
- **NO** crear helper de tamaño: el componente llama a `formatObjectSize` directamente.

## Detalle del algoritmo (KISS)
- "Vecino a la derecha": entre los `others` cuyo rango Y se solapa con el de `moving`, el de menor
  `x` que esté a la derecha (su `x >= moving.x+moving.width`); gap = ese `x` − borde derecho de
  `moving`. Análogo para los otros 3 lados.
- Sin solape de proyección en un eje ⇒ ese vecino no cuenta para ese lado (evita cotas sin sentido).

## Tests
- `tests/canvas/live-dimensions.test.ts`:
  - Vecino a cada lado → gap correcto en metros.
  - Vecino sin solape de proyección → ignorado.
  - Sin vecinos pero con `roomBounds` → mide a la pared.
  - Sin vecinos ni bounds → todos undefined.
  - Objetos solapados → gap 0 (o negativo, según lo decidido).

## Validación
- `bunx vitest run tests/canvas/live-dimensions.test.ts` verde. `bunx tsc` limpio.
