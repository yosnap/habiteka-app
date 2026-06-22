---
phase: 3
title: "Verificacion y calibracion"
status: pending
effort: ""
---

# Phase 3: Verificacion y calibracion

## Overview

Verificar en 3D que cada modelo nuevo se ve como su kind y está bien orientado; calibrar el
`frontOffsetRad` de cada uno mirando el render. Cerrar F8.

## Implementation Steps
1. En `/dev/3d`, montar una escena con los kinds nuevos (ampliar el doc de dev con uno de cada, o
   usar el wizard "cocina"/"dormitorio" para ver nevera/horno/cama/armario juntos).
2. Por cada modelo, mirar su orientación y fijar `frontOffsetRad` en `furniture-models.ts` para que
   el frente coincida con la rotación del doc (p. ej. la nevera con la puerta hacia el interior).
3. Confirmar que nevera ≠ armario ≠ encimera… se distinguen claramente; placeholders donde no haya modelo.
4. Medir peso total de assets y FPS; comprobar que sigue ≥30 y el bundle no se dispara.
5. tsc + eslint + `bunx vitest run`. Capturas en `plans/.../reports/`.

## Success Criteria
- [ ] Cada modelo nuevo se ve como su kind y bien orientado (frontOffsetRad calibrado).
- [ ] nevera/armario/encimera/etc. distinguibles en 3D; placeholders claros donde falte.
- [ ] FPS ≥30, peso de assets controlado, 0 errores de consola.
- [ ] tsc + eslint + vitest verdes; sin regresiones en F6/F7.

## Risk Assessment
- Orientación: el frente depende de cómo venga cada glTF (dato, no algoritmo). Calibrar uno a uno.
- Si el peso total crece mucho, recomprimir con texturas más pequeñas o descartar los más pesados.
