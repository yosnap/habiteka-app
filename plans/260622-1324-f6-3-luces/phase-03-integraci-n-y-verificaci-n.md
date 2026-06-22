---
phase: 3
title: Integración y verificación
status: completed
effort: ''
---

# Phase 3: Integración y verificación

## Overview

Suite completa + verificación visual con un fixture que SÍ tiene un foco (EXAMPLE_SALON no
tiene), para ver la luz iluminar la sala.

## Implementation Steps
1. Para verificar: usar un doc con un foco. Opción mínima — en `/dev/3d` añadir al doc del
   ejemplo un objeto `foco` con `light` (sin tocar `examples.ts`, que es contenido de
   producto): construir un doc derivado en la página de dev, o un fixture local de dev. NO
   añadir focos a EXAMPLE_SALON (rompería tests/snapshots de otras features).
2. `bunx tsc` + `bunx eslint` (archivos F6) + `bunx vitest run`.
3. Dev server + chrome-devtools en `/dev/3d`: confirmar que la PointLight ilumina su zona
   (zona más clara alrededor del foco), ambiente coherente, FPS ≥30, consola sin errores
   (incl. sin fallos de carga de Environment). Screenshot.
4. Confirmar aislamiento del módulo 3D y editor 2D sin regresiones.

## Success Criteria
- [ ] tsc + eslint + vitest verdes.
- [ ] Luz visible iluminando su zona en el navegador; ambiente correcto; FPS ≥30; 0 errores.
- [ ] EXAMPLE_SALON intacto (sin focos añadidos); editor 2D sin regresiones.

## Risk Assessment
- `Environment` de drei suele descargar un HDRI → puede fallar en headless/offline. Mitigar con
  preset ligero, `environmentIntensity` o quitarlo si da problemas (el ambiente base ya ilumina).
- Intensidad física mal calibrada → sala quemada o muy oscura; ajustar `MAX_POINT_INTENSITY`
  tras ver el render.
