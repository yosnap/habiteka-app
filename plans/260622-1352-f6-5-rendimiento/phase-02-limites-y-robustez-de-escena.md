---
phase: 2
title: Limites y robustez de escena
status: completed
effort: ''
---

# Phase 2: Limites y robustez de escena

## Overview

Acotar el coste de la escena para que un doc grande no hunda el FPS: límite de luces y, si
procede, de muebles. Lógica pura en `docToScene`.

## Architecture
- **Límite de luces:** muchas PointLights son caras (forward rendering). `docToScene` ya emite
  `lights`; aplicar un `MAX_LIGHTS` (p. ej. 8) ordenando por intensidad (mantener las más
  fuertes) y descartando el resto. Que sea determinista y testeable. Si se descartan luces,
  exponerlo (p. ej. `lights` truncada) — el HUD ya muestra el conteo.
- Revisar el recorte de muros: `useFrame` recorre los muros cada frame (barato, pocos muros);
  OK. Confirmar que no hay trabajo por-frame innecesario (allocations en el loop).
- Preload: ya se hace `useGLTF.preload` de los modelos del mapa. Confirmar que no se precargan
  modelos no usados (el mapa solo tiene los que existen).

## Related Code Files
- Modify: `src/canvas/3d/doc-to-scene.ts` (MAX_LIGHTS + recorte determinista).
- Modify: `tests/canvas/3d/doc-to-scene.test.ts` (test del límite).
- Review (sin cambios salvo hallazgo): `plan-3d-view.tsx` (loop de recorte sin allocations).

## Implementation Steps
1. `MAX_LIGHTS` y recorte por intensidad descendente en `docToScene` (estable).
2. Test: doc con > MAX_LIGHTS focos → `lights.length === MAX_LIGHTS`, conserva las más intensas.
3. Auditar el `useFrame` del recorte de muros: mover fuera del loop cualquier objeto temporal.

## Success Criteria
- [ ] `lights` nunca excede MAX_LIGHTS; conserva las más intensas (test verde).
- [ ] `useFrame` del recorte sin allocations por frame.
- [ ] tsc + eslint + vitest verdes.
