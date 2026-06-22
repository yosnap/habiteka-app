---
phase: 2
title: Componente de render
status: completed
effort: ''
---

# Phase 2: Componente de render

## Overview

Refactor del componente R3F del spike para que consuma `docToScene` (la lógica pura de
la fase 1) en vez de su propia conversión. El render se vuelve "tonto": dibuja lo que
el módulo puro le da. Sin muebles (F6.2); el sofá glTF del spike se retira aquí.

## Architecture

- `Plan3DView` recibe `doc: CanvasDoc`, llama `docToScene(doc)` una vez (memoizado por
  `doc`) y mapea `walls`/`floor` a mallas. Cero cálculo de coordenadas en el componente.
- Mantener: OrbitControls, luz ambiental + direccional, rejilla, HUD de FPS/draw calls
  (útil para verificación visual y F6.5). Sombras OFF (ajuste 4 predict).
- Retirar del spike: carga del glTF (`useGLTF`/sofa) y la normalización por bounding box
  — eso vuelve en F6.2. El `<Bounds>` ya estaba fuera; no reintroducir.

## Related Code Files
- Modify: `src/components/canvas/3d/plan-3d-view.tsx` (consume docToScene; quita glTF).
- Reference: `src/canvas/3d/doc-to-scene.ts` (fase 1).
- Delete: `public/models/kenney/sofa.glb` (vuelve en F6.2 con el Kit real) — opcional,
  se puede dejar hasta F6.2 para no re-descargar. Decisión: DEJARLO (lo usa F6.2).

## Implementation Steps
1. Importar `docToScene` y sus tipos; reemplazar `docToRoom3D`.
2. `RoomMesh` recibe `walls`/`floor` ya en metros (sin cambios grandes).
3. Quitar `SofaModel`, `useGLTF`, imports de `Box3/Vector3` si quedan sin uso.
4. Mantener HUD (FPS/draw calls/tris) y OrbitControls con target a media altura.

## Success Criteria
- [ ] `Plan3DView` no contiene matemática de coordenadas (toda en `doc-to-scene.ts`).
- [ ] `bunx tsc` + eslint limpios.
- [ ] Compila y la escena se monta sin errores de consola.
