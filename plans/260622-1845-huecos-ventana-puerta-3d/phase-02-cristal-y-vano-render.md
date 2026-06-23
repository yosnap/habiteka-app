---
phase: 2
title: Cristal y vano (render)
status: completed
effort: ''
---

# Phase 2: Cristal y vano (render)

## Overview
Dibujar el cristal de la ventana (panel translúcido en el hueco) y dejar el vano de la puerta
abierto (sin panel). El troceado de la fase 1 ya recorta el muro; aquí se añade solo el material de
cristal (sin marco — YAGNI).

## Requirements
- Funcional: cada ventana muestra un panel de cristal translúcido a la altura del hueco
  (alféizar→dintel), alineado con el muro. La puerta queda como vano abierto (hueco a ras de suelo).
- No-funcional: material barato (sin refracción/transmisión cara); no debe bajar el FPS bajo 30.

## Architecture
- `Scene3D.glassPanes` ya lo pobló la fase 1 (centro/size/rotationY + id `${opening.id}:glass`).
  Esta fase solo añade el render.
- Componente `GlassLayer` (archivo aparte `glass-layer.tsx`) dibuja cada pane como `<mesh>` con
  `<meshStandardMaterial transparent opacity={0.25} color="#bcd4e6" side={DoubleSide}
  depthWrite={false} />`. Sin `MeshPhysicalMaterial`/transmission (caro). `depthWrite=false` y
  `DoubleSide` DESDE EL INICIO (B3): el cristal es coplanar al grosor del muro → sin ellos hay
  z-fighting garantizado, no es "mitigación reactiva".
- **El cristal sigue la visibilidad del muro asociado (A3):** mismo `useFrame` + `shouldHideWallXZ`
  con el `center` XZ del pane, igual que `Walls`. Si no, al ocultarse el muro frontal por recorte
  el cristal queda flotando visible → artefacto. Patrón idéntico al de `Walls` (refs por índice).
- La puerta NO emite panel (vano abierto). Sin marco (YAGNI: el objetivo es "se ve el hueco").

## Related Code Files
- Create: `src/components/canvas/3d/glass-layer.tsx`.
- Modify: `src/components/canvas/3d/plan-3d-view.tsx` (montar `GlassLayer` con `scene.glassPanes`).
- (Tipo `GlassPane` y `Scene3D.glassPanes` ya creados/poblados en fase 1.)
- Modify: `tests/canvas/3d/doc-to-scene.test.ts` (afirmar 1 glassPane para win-1 — puede estar en fase 1).

## Implementation Steps
1. Crear `GlassLayer`: material translúcido barato, `DoubleSide`, `depthWrite={false}`, y recorte por
   cámara siguiendo el muro (refs por índice + `useFrame` + `shouldHideWallXZ`).
2. Montar en `Plan3DView` dentro del `<Canvas>`.
3. Verificar que la puerta queda como vano abierto (sin pane) y la ventana con cristal.
4. tsc + eslint + vitest.

## Success Criteria
- [ ] La ventana muestra cristal translúcido en el hueco; la puerta queda como vano abierto.
- [ ] `Scene3D.glassPanes` poblado y testeado (1 en el salón).
- [ ] FPS ≥30 con cristal; sin errores de consola.
- [ ] tsc + eslint + vitest verdes.

## Risk Assessment
- **Transparencia y orden de dibujado:** materiales transparentes pueden dar artefactos de
  z-order. Mitigación: opacidad media, sin depthWrite si hace falta; verificar en navegador.
- **Coste de transmisión:** NO usar transmission/refraction. Material standard transparente basta.
