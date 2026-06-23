# Reporte — Cota en vivo al mover/redimensionar (Tier 1.3 Planner5D)

**Fecha:** 2026-06-23 · **Rama:** `feat/canvas/cota-en-vivo` · **Estado:** implementado y verificado (mover).

## Qué se entregó
Cota REAL en vivo durante el gesto, estilo Planner5D/CAD:
- **Mover** → distancias (huecos) a los vecinos más cercanos en cada lado, con línea de cota.
- **Redimensionar** → tamaño ancho × fondo en metros.

## Archivos
- `src/canvas/live-dimensions.ts` (nuevo) — `neighborGaps` puro: gap a vecinos solapados en cada
  eje; solape → sin cota; reusa `WorldRect` de floating-menu-anchor.
- `tests/canvas/live-dimensions.test.ts` (nuevo) — 8 tests.
- `src/components/canvas/layers/live-dimension-overlay.tsx` (nuevo) — overlay Konva (mismo look que
  draw-wall); 'resize' → tamaño; 'move' → 4 cotas con líneas.
- `src/components/canvas/layers/structure-layer.tsx` (mod) — handlers `onDragStart` (precalcula
  vecinos), `onDragMove`, `onTransform`; estado local `live` (no toca store por frame); render del
  overlay.

## Decisiones (predict aplicado)
- MVP = distancia a VECINOS (objetos), no a paredes (futuro: requiere roomBounds).
- Distancias sobre AABB eje-alineado (aproximación honesta con objetos rotados).
- Vecinos precalculados en onDragStart, guardados en el estado `live.others` (no ref en render →
  evita el error eslint react-hooks/refs).

## Verificación
- `tsc` ✅ · `eslint` ✅ · `vitest` ✅ 498 passed / 2 skipped · `next build` ✅.
- Navegador (Playwright + dev-login, "Piso Algete"): al mover la encimera se ven "60/70/20 cm" con
  líneas de cota; desaparecen al soltar; funciona también en muros. Captura confirmada.

## Pendiente
- Verificación VISUAL del resize: la lógica `onTransform` está lista, pero arrastrar el handle del
  Transformer (dentro del `<canvas>`, sin DOM) es frágil de automatizar a ciegas → queda para prueba
  manual del usuario.

## Efecto secundario de la prueba (a deshacer)
- El canvas tiene AUTOSAVE: la verificación movió la encimera y un muro del proyecto "Piso Algete"
  (cmqpiv446...) y quedaron persistidos. Restaurable con undo (Ctrl+Z) en la app.

## Deuda futura
- Cota a las paredes de la sala (necesita bounds de la zona activa).
- Menú contextual EN 3D (cambiar color/material) — anotado aparte.
