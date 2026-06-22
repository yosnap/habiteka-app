---
title: F6.3 luces F-LUZ a Three.js
description: ''
status: completed
priority: P2
branch: feat/canvas/f6-3d-navegable
tags: []
blockedBy: []
blocks: []
created: '2026-06-22T11:25:01.337Z'
createdBy: 'ck:plan'
source: skill
---

# F6.3 luces F-LUZ a Three.js

## Overview

Mapea las luces de primera clase (F-LUZ) del `CanvasDoc` a luces Three.js. Un objeto luz
(kind `foco` o con atributos `light` color/intensidad 0–100) se convierte en una luz puntual
colocada en su posición del plano, a media altura, con su color y una intensidad física
derivada. Más iluminación ambiental base + un `Environment` para reflejos suaves. Continúa
F6.1/F6.2 (`docToScene`).

**Contexto:** F6.2 cerrada (`plans/260622-1315-f6-2-pipeline-muebles/`). Plan padre F6:
`plans/260622-1208-f6-3d-navegable-arranque/plan.md`. Modelo de luz: `src/canvas/light.ts`,
`LightProps { color, intensidad: 0-100 }`, kind `foco`.

## Decisiones de diseño
- **DRY:** el mapeo (posición XZ, altura, color, intensidad normalizada) lo calcula el módulo
  PURO `doc-to-scene.ts` (extendido con `lights: SceneLight[]`), reusando el mapeo de ejes.
  Testeable sin WebGL. En F6.2 ya se separaron las luces de los muebles con `isLight`.
- **Reconciliar `isLight`:** existe `isLight(kind)` en `light.ts` (solo kind) y un `isLight(obj)`
  local en `doc-to-scene.ts` (kind + `.light`). Unificar criterio: una luz es kind `foco` O
  tiene `.light`. Mantener el de `doc-to-scene` (más completo) y documentar; no romper `light.ts`.
- **Intensidad 0–100 → física:** mapear linealmente a un rango de intensidad de PointLight
  razonable (p. ej. 0–100 → 0–~8) con `distance`/`decay` por defecto. Color tal cual (hex).
- **Altura de la luz:** a ~80% de la altura de techo (lámpara colgada), no en el suelo.
- **Ambiente:** mantener ambientLight + directionalLight base; añadir `Environment` (preset
  drei, sin red de assets externa si es posible) para reflejos suaves. Sombras OFF (ajuste 4).

## Acceptance
- `docToScene` emite `lights` (posición, color, intensidad física) con tests (incl. clamp y
  exclusión de no-luces).
- Las luces del doc se renderizan como PointLight en la escena; ambiente + Environment.
- Fixture con un foco verificado en `/dev/3d`: la luz ilumina la zona esperada; FPS ≥30, 0 errores.
- `bunx tsc` + eslint + `bunx vitest run` verdes. Editor 2D sin regresiones.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Mapeo puro de luces](./phase-01-mapeo-puro-de-luces.md) | Completed |
| 2 | [Render de luces y ambiente](./phase-02-render-de-luces-y-ambiente.md) | Completed |
| 3 | [Integración y verificación](./phase-03-integraci-n-y-verificaci-n.md) | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
