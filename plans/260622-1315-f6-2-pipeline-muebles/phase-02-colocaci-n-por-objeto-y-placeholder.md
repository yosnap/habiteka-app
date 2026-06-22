---
phase: 2
title: Colocación por objeto y placeholder
status: completed
effort: ''
---

# Phase 2: Colocación por objeto y placeholder

## Overview

Componentes R3F que renderizan los muebles: uno carga el glTF del mapa (normalizado a las
medidas reales y apoyado en el suelo), otro dibuja el placeholder (caja etiquetada). El
componente solo consume `scene.furniture` (la geometría ya viene calculada de la fase 1).

## Architecture
- `FurnitureModel({ item, url })`: `useGLTF(url)`, clona la escena (un glTF reusado en
  varias instancias necesita clon), mide bounding box y escala a `item.size` (ancho×fondo),
  apoya en y=0, posiciona en `item.center` y rota `item.rotationY`. Patrón del spike.
- `FurniturePlaceholder({ item })`: `boxGeometry` a `item.size`, color por categoría del
  kind, ligeramente translúcido para distinguirlo de un modelo real.
- `FurnitureLayer({ items })`: por cada item, si `furnitureModelUrl(kind)` → `FurnitureModel`
  (envuelto en `Suspense` con el placeholder como fallback), si no → `FurniturePlaceholder`.
- Color por categoría: derivar de `CATALOG` (qué categoría contiene el kind) o un mapa simple.

## Related Code Files
- Create: `src/components/canvas/3d/furniture-layer.tsx`.
- Modify: `src/components/canvas/3d/plan-3d-view.tsx` (montar `FurnitureLayer`, `Suspense`,
  preload del mapa).
- Reference: `src/canvas/3d/furniture-models.ts`, `src/canvas/catalog.ts`.

## Implementation Steps
1. `furniture-layer.tsx` con `FurnitureModel`, `FurniturePlaceholder`, `FurnitureLayer`.
2. En `plan-3d-view.tsx`: `<Suspense>` + `<FurnitureLayer items={scene.furniture} />`;
   `useGLTF.preload` de las urls del mapa.
3. Mantener HUD (añadir conteo de muebles), sombras OFF.

## Success Criteria
- [ ] glTF reales (silla/sofá/lámpara) se colocan a escala y posición correctas.
- [ ] kinds sin modelo → caja etiquetada por categoría.
- [ ] tsc + eslint limpios; compila sin errores de consola.
