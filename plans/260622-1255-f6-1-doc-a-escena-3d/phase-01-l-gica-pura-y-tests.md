---
phase: 1
title: Lógica pura y tests
status: completed
effort: ''
---

# Phase 1: Lógica pura y tests

## Overview

Módulo PURO `doc-to-scene.ts` (sin React/Three) que convierte un `CanvasDoc` a una
descripción de escena 3D (suelo + muros en metros), reusando `scale.ts`. Tests que
fijan el contrato de conversión y mapeo de ejes. Es el corazón de F6.1.

## Architecture

**Mapeo de ejes (la fuente de bugs):**
- 2D/Konva: origen arriba-izq, X→derecha, Y→ABAJO. Unidad = px de stage.
- 3D/Three: X→derecha, Y→ARRIBA (vertical), Z→hacia cámara. Suelo en plano XZ.
- Convención: `X₃ = (cx − centroX)/pxPerMeter`, `Z₃ = (cy − centroY)/pxPerMeter`
  (Y-2D → Z-3D), altura en Y. Centro = centro del bounding box del plano.
- Rotación 2D (grados, horaria, Y-abajo) → rotación 3D alrededor de Y: `−rot·π/180`.

**Reuso (DRY):** `pxToMeters` y `effectiveHeightM` viven ya en `src/canvas/scale.ts`
(puros, testeados). NO duplicarlos. `doc-to-scene.ts` aporta solo: cálculo de centro,
mapeo de ejes, ensamblado de primitivas (WallBox/FloorRect) y selección estructural.

**Tipos de salida** (serializables, sin dependencias de Three):
- `WallBox { id, center:[x,y,z], size:[w,h,d], rotationY }` (metros).
- `FloorRect { size:[w,d] }` (metros).
- `Scene3D { floor, walls, ceilingHeightM, pxPerMeter, planCenterPx }`.

## Related Code Files
- Create: `src/canvas/3d/doc-to-scene.ts` (módulo puro definitivo).
- Create: `tests/canvas/3d/doc-to-scene.test.ts`.
- Reference (no modificar): `src/canvas/scale.ts`, `src/canvas/types.ts`,
  `src/canvas/examples.ts` (EXAMPLE_SALON como fixture).
- Delete al final de F6.1: `src/canvas/3d/spike/doc-to-room.ts` (lo sustituye este).

## Implementation Steps
1. Crear `doc-to-scene.ts`: `planCenterPx`, `planPointToXZ`, `docToScene`. Usar
   `pxToMeters` y `effectiveHeightM` de `scale.ts`. Defaults: `pxPerMeter` 100 si no
   hay escala; `ceilingHeightM` via DEFAULT_CEILING_M de scale.ts.
2. Estructurales = `wall|window|door`. Muros = cajas a su altura efectiva. Suelo =
   bounding box del contorno estructural (o de todos si no hay muros).
3. Tests (`vitest`):
   - px→m: longitud conocida a escala 100 → metros esperados.
   - mapeo de ejes: objeto en esquina del plano → su [x,z] esperado relativo al centro.
   - Y-2D→Z-3D: dos objetos que difieren solo en Y (px) difieren solo en Z (m).
   - rotación: 90° en 2D → `rotationY` esperado en radianes.
   - altura: muro sin heightM toma ceilingHeightM; con heightM lo respeta.
   - EXAMPLE_SALON: suelo ≈ 5,2 × 3,7 m; 6 muros; centrado en ~0.

## Success Criteria
- [ ] `doc-to-scene.ts` puro, sin imports de react/three, reusa `scale.ts`.
- [ ] `tests/canvas/3d/doc-to-scene.test.ts` cubre px→m, ejes, Y→Z, rotación, alturas, fixture.
- [ ] `bunx vitest run tests/canvas/3d/doc-to-scene.test.ts` verde.
- [ ] `bunx tsc` + eslint limpios sobre los archivos nuevos.
