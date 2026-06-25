---
title: F6.5 rendimiento y pulido
description: ''
status: completed
priority: P2
branch: feat/canvas/f6-3d-navegable
tags: []
blockedBy: []
blocks: []
created: '2026-06-22T11:52:41.149Z'
createdBy: 'ck:plan'
source: skill
---

# F6.5 rendimiento y pulido

## Overview

Última fase de F6: optimizar y pulir lo construido (F6.0–F6.4). Medición previa hecha:
chunk three **952 KB / 253 KB gzip** (lazy, OK); **assets glTF = 16 MB** (lampara 9,1 MB ⚠️,
silla 3,9 MB, sofa 3,0 MB); duplicado huérfano `public/models/kenney/sofa.glb` (deuda del
spike, sin usos). El cuello real es el PESO DE LOS ASSETS, no el código.

**Contexto:** F6.0–F6.4 cerradas. Plan padre F6: `plans/260622-1208-f6-3d-navegable-arranque/plan.md`.

## Objetivos (medibles)
1. **Assets:** comprimir los glTF (meshopt/Draco con `@gltf-transform/cli` 4.4) → bajar los
   16 MB de forma notable. Borrar el duplicado huérfano del spike.
2. **Robustez de escena:** límite de luces (evitar que N focos hundan el FPS), y revisar el
   coste del recorte de muros / preload.
3. **Code-review del flujo completo** (lo pide el plan F6) + medición final (bundle, FPS,
   móvil best-effort).

## Acceptance
- Assets glTF notablemente más ligeros (medido antes/después); duplicado borrado; los modelos
  siguen viéndose bien en `/dev/3d`.
- Límite de luces aplicado y testeado (lógica pura).
- Code-review pasado (hallazgos resueltos o anotados). Medición final documentada en un reporte.
- `bunx tsc` + eslint + `bunx vitest run` verdes. Editor 2D sin regresiones.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Optimizacion de assets glTF](./phase-01-optimizacion-de-assets-gltf.md) | Completed |
| 2 | [Limites y robustez de escena](./phase-02-limites-y-robustez-de-escena.md) | Completed |
| 3 | [Code-review y medicion final](./phase-03-code-review-y-medicion-final.md) | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
