---
phase: 2
title: Recorte de muros por camara
status: completed
effort: ''
---

# Phase 2: Recorte de muros por camara

## Overview

Oculta automáticamente los muros que quedan entre la cámara y el interior de la sala, para
ver dentro al orbitar (estilo Planner5D/Sims).

## Architecture
- Criterio: un muro se oculta si está en el lado de la sala MÁS CERCANO a la cámara. Como los
  muros del contorno están centrados respecto al origen (centro de la sala), se puede usar la
  proyección de la posición del muro sobre el vector cámara→centro: si el muro está en la
  mitad delantera (más cerca de la cámara que el centro, con margen), se atenúa/oculta.
  Más robusto que normales: cada muro guarda su `center`; comparar `dot(camPos - wallCenter,
  camPos - sceneCenter)` o la distancia muro-cámara vs centro-cámara.
- Implementación en `RoomMesh`/un sub-componente con `useFrame`: cada frame, para cada muro,
  decidir visible/oculto (o `opacity`/`visible`) según la posición actual de la cámara.
  Suelo siempre visible. Transición suave opcional (lerp de opacidad) — v1 puede ser binario
  visible/oculto para simplicidad, con material transparente.
- Mantener la altura/posición; solo cambia visibilidad/opacidad. Sin recrear geometría.

## Related Code Files
- Modify: `src/components/canvas/3d/plan-3d-view.tsx` (lógica de recorte en RoomMesh).
- Posible: pequeño helper puro `shouldHideWall(wallCenter, camPos, sceneCenter)` testeable.

## Implementation Steps
1. Helper puro `shouldHideWall(wallCenterXZ, camXZ, centerXZ)` → boolean (testeable sin WebGL).
2. En el render de muros, `useFrame` lee la cámara y aplica `visible`/opacidad por muro.
3. Probar orbitando: el muro frontal desaparece, el del fondo se mantiene; al girar, cambia.

## Success Criteria
- [ ] Helper de recorte con test unitario (delante→oculto, detrás→visible).
- [ ] Al orbitar, los muros delanteros se ocultan y se ve el interior.
- [ ] tsc + eslint limpios; FPS estable.
