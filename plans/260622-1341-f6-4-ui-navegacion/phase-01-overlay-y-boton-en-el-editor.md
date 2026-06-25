---
phase: 1
title: Overlay y boton en el editor
status: completed
effort: ''
---

# Phase 1: Overlay y boton en el editor

## Overview

Botón "Ver en 3D" en la barra del editor + overlay a pantalla completa que monta
`Plan3DView` con el doc de la zona activa. Lazy-load del módulo 3D.

## Architecture
- `Plan3DOverlay`: portal/fixed inset-0, fondo, botón cerrar (X), cierre con Esc. Monta
  `Plan3DView` (dynamic `ssr:false`) con el doc recibido. Su propio `dynamic` mantiene el
  módulo 3D fuera del bundle del editor.
- En `canvas-workspace.tsx`: estado `show3D`; botón "Ver en 3D" junto a los otros; al abrir,
  lee el doc actual del store (`useCanvasStore.getState().doc`) y se lo pasa al overlay.
- El doc se captura al abrir (snapshot); no hace falta reactividad en vivo en v1.

## Related Code Files
- Create: `src/components/canvas/3d/plan-3d-overlay.tsx`.
- Modify: `src/components/canvas/canvas-workspace.tsx` (botón + estado + render overlay).
- Reference: `src/canvas/canvas-store.ts` (doc de la zona activa).

## Implementation Steps
1. `plan-3d-overlay.tsx`: overlay fixed, cerrar con X y Esc (listener de tecla con cleanup),
   `Plan3DView` dynamic dentro.
2. En `canvas-workspace.tsx`: `const [show3D, setShow3D] = useState(false)`; botón "Ver en 3D";
   al pulsar, snapshot del doc del store → overlay.
3. Verificar lazy: el módulo 3D solo se importa dinámicamente (grep).

## Success Criteria
- [ ] Botón abre overlay con la escena de la zona activa; Esc/X cierra.
- [ ] Módulo 3D no entra en el bundle del editor (sigue dynamic).
- [ ] tsc + eslint limpios; sin regresiones en el editor 2D.
