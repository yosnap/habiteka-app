---
title: F6.1 doc→escena 3D (geometría base + tests)
description: ''
status: completed
priority: P2
branch: feat/canvas/f6-3d-navegable
tags: []
blockedBy: []
blocks: []
created: '2026-06-22T10:57:56.804Z'
createdBy: 'ck:plan'
source: skill
---

# F6.1 doc→escena 3D (geometría base + tests)

## Overview

Convierte el `CanvasDoc` (plano 2D) en una **escena 3D** robusta y testeada: suelo
del polígono, muros extruidos a altura de techo, sistema de coordenadas px→metros y
**mapeo de ejes Konva (Y-abajo) → Three (Y-arriba / Z-profundidad)**. Sin muebles aún
(eso es F6.2). Reescribe la lógica desechable del spike F6.0 reusando `scale.ts` y la
separa del render para poder testearla sin WebGL.

**Contexto:** spike F6.0 dio GO (`plans/reports/spike-viabilidad-f6-0-3d-navegable-go-nogo-report.md`).
Plan padre F6: `plans/260622-1208-f6-3d-navegable-arranque/plan.md`.

**Ajuste 3 del /ck:predict (obligatorio):** tests de la conversión px→m y del mapeo
de ejes — un punto del plano debe mapear a su coordenada 3D esperada. Es la fuente de
bugs sutiles de desalineación 2D↔3D.

## Acceptance
- `docToScene(doc)` puro devuelve suelo + muros en metros, centrados, con ejes
  correctos; cubierto por tests (px→m, mapeo de ejes, rotación, defaults de altura).
- El componente de render consume `docToScene` (no recalcula geometría) y muestra la
  sala a escala real en `/dev/3d`, verificado en el navegador.
- `bunx tsc` + eslint + `bunx vitest run` verdes. Sin regresiones en el editor 2D.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Lógica pura y tests](./phase-01-l-gica-pura-y-tests.md) | Completed |
| 2 | [Componente de render](./phase-02-componente-de-render.md) | Completed |
| 3 | [Integración y verificación](./phase-03-integraci-n-y-verificaci-n.md) | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
