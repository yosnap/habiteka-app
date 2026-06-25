---
phase: 1
title: Mapa kind→glTF y cargador
status: completed
effort: ''
---

# Phase 1: Mapa kind→glTF y cargador

## Overview

Extiende `doc-to-scene.ts` para emitir la lista de muebles (lógica pura, testeada) y crea
el mapa declarativo `kind→glTF` + un cargador glTF cacheado.

## Architecture

**Lógica pura (extiende `doc-to-scene.ts`):**
- `FurnitureItem { id, kind, center:[x,y,z], size:[w,h,d], rotationY }` en metros. `center.y`
  apoya el objeto en el suelo (= altura/2). `size` = medidas reales del doc (px→m), `h` =
  `effectiveHeightM` (reusa scale.ts). Reusa `planPointToXZ` y `rotation2DToY`.
- `Scene3D` gana `furniture: FurnitureItem[]`. Muebles = objetos NO estructurales y NO luz
  (las luces son F6.3). Productos del marketplace fuera de alcance aquí.

**Mapa `kind→glTF` declarativo** (`src/canvas/3d/furniture-models.ts`):
- `Record<StructKind, { url, /* ajustes opcionales */ }>` parcial. Solo los kinds con modelo
  real. Resto → placeholder. Inicial: `silla`, `lampara`, `sofa`.
- `furnitureModelUrl(kind): string | null`.

**Cargador cacheado** (componente, fase 2): `useGLTF(url)` ya cachea por URL; `useGLTF.preload`
para los modelos del mapa.

## Related Code Files
- Modify: `src/canvas/3d/doc-to-scene.ts` (+ `FurnitureItem`, `furniture` en `Scene3D`).
- Modify: `tests/canvas/3d/doc-to-scene.test.ts` (+ tests de furniture).
- Create: `src/canvas/3d/furniture-models.ts` (mapa declarativo + resolver).

## Implementation Steps
1. Añadir `FurnitureItem` y poblar `furniture` en `docToScene` (no estructurales, no luz).
2. Tests: un sofá en EXAMPLE_SALON → su center XZ y size esperados; cuenta de muebles;
   excluye muros y la lámpara-como-luz si aplica (en este doc `lampara` es mueble).
3. Crear `furniture-models.ts` con el mapa inicial y `furnitureModelUrl`.

## Success Criteria
- [ ] `docToScene` emite `furniture` correcta (tests verdes).
- [ ] `furniture-models.ts` resuelve url por kind, null si no hay.
- [ ] tsc + eslint + vitest verdes.
