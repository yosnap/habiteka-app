---
phase: 3
title: Integración y verificación
status: completed
effort: ''
---

# Phase 3: Integración y verificación

## Overview

Eliminar el módulo desechable del spike, correr la suite completa y verificar la escena
en el navegador (lección: verificar contra el build real, no solo tsc/tests).

## Related Code Files
- Delete: `src/canvas/3d/spike/doc-to-room.ts` (y la carpeta `spike/` si queda vacía).
- Verify: `src/app/dev/3d/page.tsx` sigue montando `Plan3DView` con `EXAMPLE_SALON`.

## Implementation Steps
1. Borrar `doc-to-room.ts`; confirmar que nada lo importa (grep).
2. `bunx tsc --noEmit` (ignorar el error PREEXISTENTE ajeno de `canvas-clipboard.test.ts`).
3. `bunx eslint` sobre archivos F6.
4. `bunx vitest run` (suite focal del canvas + el nuevo test 3D).
5. Dev server + chrome-devtools en `/dev/3d`: ver la sala, FPS ≥30, escala correcta,
   consola sin errores. Screenshot a `plans/reports/`.

## Success Criteria
- [ ] `doc-to-room.ts` borrado; sin imports colgando.
- [ ] tsc (sin contar el error preexistente ajeno) + eslint + vitest verdes.
- [ ] Escena 3D verificada en navegador (sala a escala, FPS ≥30, 0 errores).
- [ ] Editor 2D sin regresiones (la ruta `/projects/[id]` no carga el chunk 3D).

## Risk Assessment
- Desalineación 2D↔3D por mapeo de ejes → mitigado con tests de la fase 1.
- Regresión en el editor 2D → el módulo 3D sigue aislado (solo `/dev/3d` lo importa).
