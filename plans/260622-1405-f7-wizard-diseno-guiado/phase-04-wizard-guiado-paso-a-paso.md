---
phase: 4
title: "Wizard guiado paso a paso"
status: pending
effort: ""
---

# Phase 4: Wizard guiado paso a paso

## Overview

Asistente de inicio (modal/overlay) que aparece en un proyecto/zona VACÍO y guía: forma de la
sala → dimensiones → tipo/estilo → (amueblar en fase 5) → ver en 3D. Genera un `CanvasDoc` y lo
carga en el editor. Reusa el modelo de datos y el render existentes.

## Architecture
- **Disparo (red-team #13/Failure #4):** "vacío" = NO solo `objects.length===0`, sino también
  `strokes`, `baseImage` y `products` vacíos. Un usuario puede tener una foto base + trazos a mano sin
  StructObjs; auto-abrir el wizard y hacer `load()` ahí BORRARÍA esa foto/trazos sin undo. La detección
  de "vacío" es NUEVA (no existe el patrón en canvas-workspace.tsx — claim corregido). Ofrecer el wizard
  (no auto-aplicar) con opción de saltar.
- **Persistencia (red-team #3, Critical):** NO confiar en "se persiste por el autosave existente". `load()`
  resetea past/future (canvas-store.ts:86) → el doc del wizard no es deshacible y puede pisar contenido
  previo. Y el autosave es un debounce de 800ms en useMountEffect cuyo cleanup cancela el timer al navegar
  (canvas-workspace.tsx:176-194); cambiar de zona / "Ver en 3D" hace `router.push`+`refresh`
  (zone-switcher.tsx) y DESMONTA → el doc del wizard se perdería. Solución: tras generar, **insertar por el
  flujo de historial (`insertObjects`) y forzar un guardado inmediato (flush sin debounce)** antes de
  permitir navegar. Criterio de aceptación: recargar tras el wizard conserva la sala.
- **Pasos** (estado local del componente, sin router):
  1. Forma: rectangular en v1 (L/U/no-rectangular = futuro). 
  2. Dimensiones: ancho × largo en metros (inputs con `number-input`), altura de techo (`ceilingHeightM`).
  3. Tipo de sala: salón/dormitorio/cocina/baño (define el set de auto-amueblado de la fase 5).
- **Generación del doc**: función PURA `buildRoomDoc({ shape, widthM, lengthM, ceilingHeightM, scale })`
  → `CanvasDoc` con los 4 muros + escala. Reusa `metersToPx`. Testeable sin UI.
- Al confirmar: `useCanvasStore.load(doc)` (se persiste por el autosave existente). Botón "Ver en 3D"
  ya existe (F6) para el paso final.

## Related Code Files
- Create: `src/canvas/wizard/build-room-doc.ts` (puro: parámetros → CanvasDoc con muros + escala).
- Create: `src/components/canvas/wizard/design-wizard.tsx` (modal de pasos).
- Create: `tests/canvas/wizard/build-room-doc.test.ts`.
- Modify: `src/components/canvas/canvas-workspace.tsx` (disparo del wizard en doc vacío).
- Reference: `src/canvas/scale.ts`, `number-input.tsx`, examples.ts (forma de un doc válido).

## Implementation Steps
1. `build-room-doc.ts`: rectángulo W×L → 4 muros (grosor 0,15 m) + escala + ceilingHeightM. Tests de
   dimensiones (muros a las medidas pedidas, suelo resultante correcto).
2. `design-wizard.tsx`: pasos forma→dims→tipo; preview simple; "Crear" → carga el doc.
3. Cablear disparo en workspace (vacío → ofrecer wizard, con "saltar").
4. Verificar: proyecto nuevo → wizard → sala a medidas → editable → "Ver en 3D".

## Success Criteria
- [ ] `buildRoomDoc` puro y testeado (sala a las medidas pedidas).
- [ ] Wizard genera la sala y la carga en el editor; se puede saltar.
- [ ] tsc + eslint + vitest verdes.

## Risk Assessment
- No romper el flujo de proyectos ya existentes (con objetos): el wizard SOLO se ofrece en vacío.
- Multi-zona: el wizard opera sobre la zona activa (mismo doc del store).
