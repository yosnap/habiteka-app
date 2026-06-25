---
phase: 1
title: Mapeo puro de luces
status: completed
effort: ''
---

# Phase 1: Mapeo puro de luces

## Overview

Extiende `doc-to-scene.ts` con `lights: SceneLight[]`: cada objeto luz del doc → una luz
puntual posicionada en metros, con color e intensidad física. Lógica pura, testeada.

## Architecture
- `SceneLight { id, position:[x,y,z], color:string, intensity:number, distanceM, decay }`.
  `position` = XZ del objeto (reusa `planPointToXZ`), `y` = ~80% de `ceilingHeightM`.
  `color` = `light.color` (o `defaultLight()` si falta). `intensity` = `clampIntensity(0-100)`
  mapeado a rango físico (lineal 0–100 → 0–`MAX_POINT_INTENSITY`, p. ej. 8).
  `distanceM`/`decay`: valores por defecto razonables para una sala.
- Reusar de `light.ts`: `clampIntensity`, `defaultLight`. NO duplicar el clamp.
- Criterio de luz: kind `foco` O `o.light != null` (el `isLight` ya presente en doc-to-scene).
  Mantenerlo como única fuente; añadir comentario que lo relaciona con `light.ts`.

## Related Code Files
- Modify: `src/canvas/3d/doc-to-scene.ts` (+ `SceneLight`, `lights`, mapeo de intensidad).
- Modify: `src/canvas/3d/doc-to-scene.test.ts` (+ tests de luces).
- Reference: `src/canvas/light.ts`.

## Implementation Steps
1. Definir `SceneLight` y `MAX_POINT_INTENSITY`; helper `intensity0to100ToPhysical`.
2. Poblar `lights` en `docToScene` (objetos que cumplen `isLight`).
3. Tests: foco → posición XZ y altura esperadas; intensidad 0→0, 100→MAX, 50→MAX/2;
   color por defecto si falta; objeto sin luz no aparece; muro/mueble excluidos.

## Success Criteria
- [ ] `docToScene` emite `lights` correcta (tests verdes).
- [ ] Reusa `clampIntensity`/`defaultLight` de `light.ts` (sin duplicar).
- [ ] tsc + eslint + vitest verdes.
