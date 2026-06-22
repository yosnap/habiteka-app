---
title: "F8 modelos 3D por kind (catalogo visual)"
description: ""
status: pending
priority: P2
branch: "feat/canvas/f6-3d-navegable"
tags: []
blockedBy: []
blocks: []
created: "2026-06-22T15:01:50.003Z"
createdBy: "ck:plan"
source: skill
---

# F8 modelos 3D por kind (catalogo visual)

## Overview

Hacer que cada mueble se vea como **lo que es** en 3D (nevera ≠ armario ≠ encimera ≠ cama…),
integrando modelos glTF reales por `kind`, en vez de las cajas-placeholder iguales de hoy.
Construye sobre F6/F7 (mapa declarativo kind→glTF + pipeline de compresión + placeholder ya
existen). Decisión del usuario: **modelos CC0 sueltos** por kind (no el ZIP de Kenney).

**Realismo del alcance:** conseguir `.glb` CC0 descargables DIRECTO por kind fue difícil en F7.7
(Khronos tiene pocos, Poly Pizza no da descarga directa fácil, Kenney es ZIP). Por eso la **fase 1
es un spike de disponibilidad**: su resultado define cuántos kinds tendrán modelo real vs placeholder.
El placeholder seguirá cubriendo lo que no se encuentre (honesto, sin bloquear).

## Contexto (no re-investigar)
- Mapa `src/canvas/3d/furniture-models.ts` (`FURNITURE_MODELS` kind→{url, frontOffsetRad?}); hoy
  silla (CC0) + sofa (CC-BY). `furnitureModelUrl`, `furnitureFrontOffset`, `allFurnitureModelUrls`.
- Render: `src/components/canvas/3d/furniture-layer.tsx` (FurnitureModel normaliza por bbox a las
  medidas del kind; placeholder = caja por categoría). Precarga selectiva en `plan-3d-view.tsx`.
- Compresión (F6.5): `@gltf-transform/cli optimize --texture-compress webp --texture-size 1024
  --compress meshopt` (~−90%). Manifiesto `public/models/cc0/manifest.json` (url/licencia/SHA-256).
- Medidas reales por kind en `src/canvas/catalog.ts`. Orientación: `frontOffsetRad` (F7.6, sin calibrar).
- ~26 kinds objetivo: sanitarios (inodoro/lavabo/ducha/banera/bidet), cocina (fregadero/encimera/
  nevera/horno/isla), mobiliario (cama/mesa/armario/estanteria/mesilla), electronica (tv/ordenador/
  lampara), decoracion (alfombra/planta/chimenea). silla/sofa ya tienen.

## Acceptance
- Subset de kinds prioritarios con modelo glTF real (al menos: nevera, armario, cama, inodoro, mesa,
  tv — los que el usuario citó y los más frecuentes), distinguibles entre sí en 3D.
- Cada modelo: comprimido, registrado en `manifest.json` (url/licencia/SHA-256), `frontOffsetRad` calibrado.
- Placeholder honesto para los kinds sin modelo.
- `bunx tsc` + eslint + `bunx vitest run` verdes; verificado en `/dev/3d` (cada modelo se ve como su kind).
- Sin regresiones; bundle/peso controlado (todo comprimido).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Spike de disponibilidad de assets](./phase-01-spike-de-disponibilidad-de-assets.md) | Pending |
| 2 | [Integracion y compresion de modelos](./phase-02-integracion-y-compresion-de-modelos.md) | Pending |
| 3 | [Verificacion y calibracion](./phase-03-verificacion-y-calibracion.md) | Pending |

## Dependencies

<!-- Cross-plan dependencies -->
