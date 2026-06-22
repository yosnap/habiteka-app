---
phase: 1
title: Verificacion del flujo base
status: completed
effort: ''
---

# Phase 1: Verificacion del flujo base

## Overview

Verificar de forma REPRODUCIBLE (no a clics a ciegas) que el flujo actual 2D→3D respeta lo
dibujado, partiendo de un proyecto NUEVO. Documenta el estado base antes de añadir features.

## Architecture
- Crear el doc de prueba de forma determinista mediante un **seed idempotente** (upsert por slug
  fijo, p. ej. `f7-verif`) o un proyecto efímero con limpieza explícita. **NO** acoplar a
  `prisma/dev-seed.ts` general ni dejar residuos: la BD `habiteka_dev` es COMPARTIDA por los tests
  (package.json:14 corre `db:dev-seed` tras vitest; sin teardown), así que un seed que acumula
  proyectos contamina verificaciones (red-team #7). **Descartada la rama e2e Playwright** sobre
  canvas Konva/WebGL: es frágil (el propio plan lo admitía) — red-team #11.
- **Doc de prueba con un caso ROTADO (red-team #1, Critical):** además de la sala rectangular, incluir
  al menos UN muro con `rotation ≠ 0` (p. ej. 90°). Todo lo existente es rotation=0 (examples.ts), por
  eso el desajuste de pivote 2D↔3D nunca se ha ejercitado. Sin un caso rotado, la línea base saldría
  falsamente verde y no protegería contra el riesgo P0 del núcleo.
- Si se toca `serialize.ts` para sembrar docs: cerrar de paso la validación de `baseImage.url`
  (red-team #13) — exigir ruta propia / `https://` allowlist, rechazar `data:`/`javascript:`/externas
  (`base-image-layer.tsx:24` la carga con `useImage(url,'anonymous')`).

## Related Code Files
- Reference: `prisma/dev-seed.ts`, `src/canvas/examples.ts`, `src/app/(app)/projects/[id]/page.tsx`.
- Create (si se elige e2e): test en `tests/` que cubra crear→dibujar→ver 3D.

## Implementation Steps
1. Crear el doc de prueba con un seed IDEMPOTENTE (upsert por slug fijo, sin residuos en `habiteka_dev`),
   incluyendo un muro `rotation≠0` además de la sala rectangular.
2. Abrir el MISMO doc/zona en 2D y en "Ver en 3D"; comparar posición de cada objeto (incl. el rotado) y escala.
3. Medir el desfase del muro rotado entre 2D y 3D (define el trabajo de pivote de la fase 2).
4. Reporte de línea base en `plans/.../reports/`: qué coincide y qué no (desfase rotación, orientación, modelos).

## Success Criteria
- [x] Flujo verificado con proyecto nuevo, de forma repetible e IDEMPOTENTE (no clics manuales, sin
  residuos en la BD dev compartida).
- [x] **Caso rotado medido:** documentado si un muro a 90° cae en el MISMO punto físico en 2D y 3D, o
  el desfase exacto (esto define el trabajo de pivote de la fase 2).
- [x] Reporte de estado base en `plans/.../reports/` (desfase de rotación, orientación, modelos, draw walls).

## Risk Assessment
- Automatización de UI sobre canvas Konva/WebGL es frágil → seed idempotente para el doc; reservar la
  automatización solo a abrir el 3D y capturar.
- Línea base con solo muros axis-aligned daría falso verde → obligatorio el caso rotado.
