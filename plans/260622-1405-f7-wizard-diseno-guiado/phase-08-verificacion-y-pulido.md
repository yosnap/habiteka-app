---
phase: 8
title: "Verificacion y pulido"
status: pending
effort: ""
---

# Phase 8: Verificacion y pulido

## Overview

Verificación end-to-end del flujo completo F7 con un proyecto NUEVO y code-review del rasgo.

## Implementation Steps
1. Flujo completo en navegador (con dev-login admin): proyecto nuevo → wizard (forma→dims→amueblar)
   → editar (dibujar un muro extra con cota) → "Ver en 3D" → comprobar muebles orientados, modelos
   coherentes, escala correcta. Comparar 2D vs 3D del MISMO proyecto (cerrar el hueco de método previo).
2. `bunx tsc` + `bunx eslint` + `bunx vitest run` (toda la suite). Build de producción.
3. Code-review del rasgo F7 (draw-wall, wizard, autofurnish, orientación, modelos).
4. Reporte final de F7 en `plans/.../reports/` con métricas y estado.

## Success Criteria
- [ ] Flujo completo verificado con proyecto nuevo (2D↔3D coherente, orientación y modelos OK).
- [ ] tsc + eslint + vitest + build verdes.
- [ ] Code-review pasado; hallazgos resueltos o anotados.
- [ ] Sin regresiones en editor 2D ni en F6.

## Risk Assessment
- Automatización de UI frágil sobre canvas: para la verificación, preferir doc por seed determinista y
  reservar la automatización a abrir 3D + capturar (lección de la verificación previa de F6).
