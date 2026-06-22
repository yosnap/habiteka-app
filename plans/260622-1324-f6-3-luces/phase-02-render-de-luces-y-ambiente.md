---
phase: 2
title: Render de luces y ambiente
status: completed
effort: ''
---

# Phase 2: Render de luces y ambiente

## Overview

Renderiza `scene.lights` como PointLights y añade un ambiente coherente (ambientLight base
+ Environment de drei). El componente solo consume datos ya calculados.

## Architecture
- `LightsLayer({ lights })`: por cada `SceneLight`, un `<pointLight>` con position/color/
  intensity/distance/decay. Sombras OFF (ajuste 4 del predict).
- Ambiente: mantener `ambientLight` + `directionalLight` base (bajar un poco su intensidad si
  hay luces del doc, para que las luces del usuario se noten). Añadir `<Environment preset=...>`
  de drei para reflejos suaves — usar un preset que no requiera descargar HDRI externo en
  build/headless; si todos requieren red, usar `<Environment background={false}>` con un preset
  ligero o un `environmentIntensity` bajo. Documentar la elección.
- Si no hay luces del doc, la escena sigue iluminada por el ambiente base (no queda a oscuras).

## Related Code Files
- Create: `src/components/canvas/3d/lights-layer.tsx`.
- Modify: `src/components/canvas/3d/plan-3d-view.tsx` (montar LightsLayer + Environment;
  ajustar ambiente base; HUD con conteo de luces).

## Implementation Steps
1. `lights-layer.tsx` con `LightsLayer`.
2. En `plan-3d-view.tsx`: montar `<LightsLayer items={scene.lights} />`, añadir `Environment`,
   ajustar luz base, añadir conteo de luces al HUD.
3. Verificar que sin Environment-asset-externo no rompe (fallback).

## Success Criteria
- [ ] Las luces del doc iluminan la escena; sin luces, el ambiente base basta.
- [ ] tsc + eslint limpios; compila sin errores de consola (ni de carga de HDRI).
