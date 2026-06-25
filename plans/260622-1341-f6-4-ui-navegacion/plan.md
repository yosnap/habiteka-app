---
title: F6.4 UI Ver en 3D + navegacion + recorte de muros
description: ''
status: completed
priority: P2
branch: feat/canvas/f6-3d-navegable
tags: []
blockedBy: []
blocks: []
created: '2026-06-22T11:44:33.627Z'
createdBy: 'ck:plan'
source: skill
---

# F6.4 UI Ver en 3D + navegacion + recorte de muros

## Overview

Conecta el 3D con el editor real: un botón "Ver en 3D" en el editor abre un **overlay a
pantalla completa** con la escena navegable de la **zona activa** (el doc ya hidratado en
`useCanvasStore`). El módulo 3D va lazy. Además, **recorte de muros por cámara** (estilo
Planner5D/Sims): los muros entre la cámara y el interior se ocultan automáticamente según
el ángulo, para ver dentro sin orbitar por arriba.

**Contexto:** F6.0–F6.3 cerradas. Hasta ahora el 3D vivía solo en `/dev/3d`; esta fase lo
lleva al producto. Plan padre F6: `plans/260622-1208-f6-3d-navegable-arranque/plan.md`.

## Decisiones (del usuario, jun-2026)
- **Presentación: overlay a pantalla completa** (no panel dividido ni ruta aparte). Botón
  en `canvas-workspace.tsx`; overlay con cerrar (Esc / botón X). El 2D sigue debajo.
- **Ver interior: recorte de muros por cámara automático** (no toggle manual). Los muros
  cuya cara mira hacia la cámara y quedan entre cámara e interior se ocultan/atenúan.
- Render de la **zona activa**: se lee `useCanvasStore.getState().doc` (ya es la zona del
  `?zona=` activo). No se toca multi-zona ni servidor.

## Acceptance
- Botón "Ver en 3D" en el editor abre overlay con la escena de la zona activa; Esc/X cierra.
- Módulo 3D lazy (no infla el bundle del editor; sigue solo importado dinámicamente).
- Al orbitar, los muros delanteros se ocultan y se ve el interior (muebles, luces).
- `bunx tsc` + eslint + `bunx vitest run` verdes. Editor 2D sin regresiones.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Overlay y boton en el editor](./phase-01-overlay-y-boton-en-el-editor.md) | Completed |
| 2 | [Recorte de muros por camara](./phase-02-recorte-de-muros-por-camara.md) | Completed |
| 3 | [Integracion y verificacion](./phase-03-integracion-y-verificacion.md) | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
