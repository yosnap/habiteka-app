---
phase: 3
title: Code-review y medicion final
status: completed
effort: ''
---

# Phase 3: Code-review y medicion final

## Overview

Code-review del flujo completo de F6 (lo pide el plan padre) + medición final documentada.

## Implementation Steps
1. **Code-review** de los archivos de F6 con `/code-review` (o code-reviewer): `doc-to-scene.ts`,
   `furniture-models.ts`, `furniture-layer.tsx`, `lights-layer.tsx`, `plan-3d-view.tsx`,
   `plan-3d-overlay.tsx`, `canvas-workspace.tsx` (cambios), `dev/3d/page.tsx`. Resolver hallazgos
   accionables; anotar los descartados con motivo.
2. **Medición final** (reporte en plans/reports/): bundle (chunk three gzip), peso de assets
   antes/después de F6.5, FPS escritorio, móvil best-effort (emular viewport móvil en
   chrome-devtools y leer FPS — best-effort, no bloqueante).
3. Suite completa: `bunx tsc` + `bunx eslint` + `bunx vitest run`. Build de producción.
4. Verificación final en `/dev/3d`: escena completa (muros recortados, muebles, luz) a FPS ≥30.

## Success Criteria
- [ ] Code-review pasado; hallazgos resueltos o anotados.
- [ ] Reporte de medición final escrito (bundle, assets, FPS escritorio/móvil).
- [ ] tsc + eslint + vitest + build verdes; `/dev/3d` OK.
- [ ] F6 "hecho" según el acceptance del plan padre.

## Risk Assessment
- Móvil best-effort: si el FPS móvil emulado es bajo, documentarlo como límite conocido de v1
  (no bloquea F6; optimización futura: instancing, LOD, menos luces).
