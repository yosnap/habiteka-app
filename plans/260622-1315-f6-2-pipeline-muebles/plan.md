---
title: F6.2 pipeline assets + muebles glTF
description: ''
status: completed
priority: P2
branch: feat/canvas/f6-3d-navegable
tags: []
blockedBy: []
blocks: []
created: '2026-06-22T11:18:32.808Z'
createdBy: 'ck:plan'
source: skill
---

# F6.2 pipeline assets + muebles glTF

## Overview

Coloca los muebles del `CanvasDoc` en la escena 3D: mapa declarativo `kind→glTF`,
cargador glTF cacheado (`useGLTF` + preload), y colocación de cada `StructObj` por su
posición/rotación/medidas reales. Los kinds sin modelo caen a un **placeholder** (caja
a escala real, coloreada por categoría) — patrón análogo al `default` de
`object-shapes.tsx` en 2D. Continúa F6.1 (`docToScene`).

**Contexto:** F6.1 cerrada (`plans/260622-1255-f6-1-doc-a-escena-3d/`). El plan padre F6
está en `plans/260622-1208-f6-3d-navegable-arranque/plan.md`.

**Assets (decisión del usuario, jun-2026):** modelos CC0 sueltos para los kinds más
comunes + placeholder para el resto. Ya descargados en `public/models/cc0/`: `silla.glb`
(CC0), `lampara.glb` (CC0), `sofa.glb` (CC-BY, atribución). El mapa es declarativo: añadir
un kind real = una línea + su .glb. Kenney Kit completo = trabajo futuro.

## Decisiones de diseño
- **DRY:** la colocación (posición/rotación/escala en metros) la calcula el módulo PURO
  `doc-to-scene.ts` (extendido con `furniture: FurnitureItem[]`), no el componente. Así el
  mapeo de ejes vive en un solo sitio y se testea sin WebGL.
- **Escala del glTF:** cada modelo viene en su escala propia; se normaliza midiendo su
  bounding box y escalándolo a las medidas reales del objeto (ancho×fondo del doc). Patrón
  ya probado en el spike (sustituyó a `<Bounds>`).
- **Placeholder:** caja a `realWidthM × heightM × realDepthM`, color por categoría.

## Acceptance
- `docToScene` emite `furniture` (kind, posición XZ, rotaciónY, tamaño real, altura) con tests.
- Mapa `kind→glTF` declarativo + cargador cacheado con preload.
- En `/dev/3d`: los muebles del salón (sofá, mesa, TV, lámpara) aparecen donde están en 2D,
  a escala; los kinds sin modelo salen como caja etiquetada. FPS ≥30, 0 errores.
- `bunx tsc` + eslint + `bunx vitest run` verdes. Editor 2D sin regresiones.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Mapa kind→glTF y cargador](./phase-01-mapa-kind-gltf-y-cargador.md) | Completed |
| 2 | [Colocación por objeto y placeholder](./phase-02-colocaci-n-por-objeto-y-placeholder.md) | Completed |
| 3 | [Integración y verificación](./phase-03-integraci-n-y-verificaci-n.md) | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
