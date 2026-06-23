---
phase: 1
title: Descomposicion de muros (puro)
status: completed
effort: ''
---

# Phase 1: Descomposicion de muros (puro)

## Overview
Núcleo del cambio, todo en lógica pura. Asociar cada ventana/puerta al muro que solapa,
proyectar el hueco al espacio local del muro y trocear el muro en cajas (`WallBox[]`) que
rodean el hueco. El render no cambia en esta fase: solo recibe más cajas (con un hueco donde
antes había pared maciza).

## Requirements
- Funcional: un muro con una ventana produce cajas izq + dcha + dintel + alféizar; con una
  puerta, izq + dcha + dintel (sin alféizar). Un muro sin huecos sigue siendo una sola caja.
- Funcional: ventana/puerta dejan de emitir su propio `WallBox` macizo de altura completa.
- No-funcional: pura (sin React/Three), determinista, testeable; no cambia el cálculo del suelo.

## Architecture

> **Defecto geométrico corregido tras red-team (C1/C2):** los muros del seed NO siguen la convención
> de Draw Walls. `w-left` (examples.ts) es `width=15, height=360, rotation=0`: su lado largo es
> `height`, no `width`, y rotation=0 NO lo indica. Draw Walls en cambio fija siempre
> `width=longitud, height=grosor, rotation=ángulo`. Por eso el eje longitudinal NO puede derivarse
> de `rotation`. Hay que derivarlo del **lado mayor del rectángulo**.

**Eje longitudinal del muro (unifica ambas convenciones):**
- `L = max(width, height)` (longitud), `t = min(width, height)` (grosor).
- Ángulo del eje û en 2D: `rotation` si `width ≥ height`; `rotation + 90°` si `height > width`.
- û en mundo (XZ) = ese ángulo convertido con la misma convención de `rotation2DToY` (Y-2D→Z-3D,
  giro invertido). NO reintroducir el bug de pivote: el centro del muro ya lo da `objectCenterPx`.

**Nuevo módulo** `src/canvas/3d/wall-openings.ts` (puro):
- `wallAxis(wall)` → `{ L, t, angleRad2D, û_xz }` según la regla de arriba. Testeado con muro
  horizontal (w≥h, rot 0), vertical (h>w, rot 0 → w-left), y Draw Wall rotado 90°.
- `associateOpening(opening, walls)` → muro `wall` con **menor distancia perpendicular** del centro
  del hueco a su eje longitudinal (NO por área de solape: los solapes reales son 6–9px y un umbral
  de área los descartaría). Tope de distancia = `(t + dimHuecoPerp)/2 + margen`. `null` solo si
  ninguno está dentro del tope (con datos válidos del seed, SIEMPRE asocia).
- `openingSpanLocal(opening, wall)` → `[u0,u1]` en metros a lo largo de û: **proyectar las 4
  esquinas del hueco** (`objectCornersPx`) sobre û, tomar `[min,max]` de los productos escalares
  (el offset perpendicular se descarta solo al proyectar). Clampar a `[0, L]`.
- `splitWallWithOpenings(wall, openings, ceilingHeightM)` → `{ boxes: WallBox[], panes: GlassPane[] }`
  en UN solo recorrido (DRY): ordena los `[u0,u1]` por u0, fusiona solapados, emite segmentos de
  muro en los gaps (altura completa) + dintel sobre cada hueco + alféizar bajo cada ventana; y por
  cada ventana, un `GlassPane`. Soporta ≥1 hueco por muro.

**Altura del hueco sobre la altura EFECTIVA del muro (M1):** `H = effectiveHeightM(wall, ceiling)`.
- Ventana: vano vertical `[SILL_M, H − LINTEL_GAP_M]` con `SILL_M=0.9`, `LINTEL_GAP_M=0.3`.
  Si `SILL_M ≥ H − LINTEL_GAP_M` (muro muy bajo) → degenerar a sin alféizar (clamp).
- Puerta: `[0, (door.heightM ?? H − LINTEL_GAP_M)]` (sin alféizar).

**Ids deterministas y únicos por segmento (A2 — evita keys duplicadas en React):** cada `WallBox`
emitido lleva id `${wall.id}:left|right|lintel|sill|seg{n}` y cada `GlassPane` `${opening.id}:glass`.
Deterministas (NO `randomUUID`: rompería memoization y tests). Test de unicidad de ids.

**Geometría local→mundo:** una caja local `[u0,u1]×[v0,v1]` (a lo largo de û y en Y) con grosor `t`
tiene centro local `((u0+u1)/2 − L/2)` sobre û y `(v0+v1)/2` en Y; mundo = `center` del muro +
`û·((u0+u1)/2 − L/2)` (û ya en XZ). `size = [|u1−u0|, |v1−v0|, t]`, `rotationY` = el del muro.

**Integración en `docToScene`:** sustituir el `.map` que mete window/door como WallBox. Nuevo flujo:
(a) `wallObjs = kind 'wall'`; (b) `openings = kind window|door`; (c) asociar cada opening a su muro;
(d) por muro, `splitWallWithOpenings(wall, susHuecos)`; (e) `walls` = unión de `boxes`,
`glassPanes` = unión de `panes`. Un muro sin huecos → 1 sola caja (igual que hoy). Window/door ya
NO emiten WallBox propio. NO se elimina el fallback "hueco sin muro" como caja maciza (YAGNI/M3):
si `associateOpening` devuelve `null` (inalcanzable con datos válidos), se omite el hueco con un
aviso, no se dibuja caja maciza (que reintroduciría "no se ve el hueco").

## Related Code Files
- Create: `src/canvas/3d/wall-openings.ts`
- Create: `tests/canvas/3d/wall-openings.test.ts`
- Modify: `src/canvas/3d/doc-to-scene.ts` (construcción de `walls`; añadir `glassPanes` a `Scene3D`
  —tipo poblado aquí, consumido en fase 2—; exportar tipos nuevos). El suelo ya usa kind 'wall'.
- Modify: `tests/canvas/3d/doc-to-scene.test.ts` — romperán y hay que reescribir a aserciones de
  comportamiento (NO de conteo): `:144` (`walls.map(id).sort() === ['d','w','win']` — ya no hay
  WallBox con id 'd'/'win') y `:313-315` (`toHaveLength(6)`). Mantener `:321-324` (suelo 5.2×3.6)
  como guardia. `build-room-doc.test.ts` NO rompe (no genera window/door) — mencionar para evitar pánico.

## Implementation Steps
1. Crear `wall-openings.ts`: `wallAxis`, `associateOpening`, `openingSpanLocal`, `splitWallWithOpenings`.
2. Tests unitarios:
   - `wallAxis`: muro horizontal (w≥h, rot 0), vertical (h>w, rot 0 = w-left), Draw Wall rot 90°.
   - ventana centrada → segmentos izq/dcha (altura completa) + dintel + alféizar, con medidas y
     span vertical `[0.9, H−0.3]`; un `GlassPane` con su rect.
   - puerta → izq/dcha + dintel, sin alféizar, vano `[0, …]`, 0 glassPanes.
   - hueco que toca un extremo (sin caja izq o dcha); hueco más ancho que el muro (clamp a [0,L]).
   - muro sin huecos → 1 caja intacta idéntica a hoy.
   - asociación correcta entre varios muros (win-1→w-top, door-1→w-left) por distancia perpendicular,
     con solapes reales de 6–9px del seed.
   - **unicidad de ids** de todas las cajas y panes resultantes.
   - 2 ventanas en un mismo muro → segmentos correctos entre ambas (orden por u).
3. Integrar en `docToScene`: window/door ya NO generan WallBox propio; muros troceados; poblar
   `Scene3D.glassPanes`.
4. Reescribir los tests de `doc-to-scene.test.ts` listados; confirmar suelo sin cambios.
5. tsc + eslint + `bunx vitest run tests/canvas/3d`.

## Success Criteria
- [ ] `wallAxis` correcto para las DOS convenciones (Draw Walls y seed manual) — testeado.
- [ ] `splitWallWithOpenings` cubierto: ventana, puerta, bordes, clamp, sin hueco, 2 huecos, ids únicos.
- [ ] `docToScene` ya no emite cajas macizas para window/door; muro troceado; `glassPanes` poblado.
- [ ] El suelo (bbox kind 'wall') no cambia; test del suelo verde.
- [ ] tsc + eslint limpios; tests de `tests/canvas/3d` verdes.

## Risk Assessment
- **Convención width/height del muro (C1):** RESUELTO con `wallAxis` por lado mayor. Test obligatorio
  con `w-left` real (h>w, rot 0) y muro Draw Wall rotado.
- **Solape mínimo 6–9px (C2/M3):** asociación por distancia perpendicular del centro, NO por área.
  Test con pares reales del seed.
- **Ids de segmentos (A2):** deterministas y únicos (`${wall.id}:left|...`), nunca heredar el id del
  muro tal cual (keys duplicadas en React → rompe el recorte por índice). Test de unicidad.
- **Altura efectiva (M1):** span vertical sobre `effectiveHeightM(wall)`, no techo absoluto; clamp si
  el muro es más bajo que alféizar+dintel.
