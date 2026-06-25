---
title: "Editor 3D interactivo (selección, gizmo, panel propiedades)"
description: "Clic en mueble 3D → menú flotante, gizmo de mover/rotar y panel de propiedades, sincronizado con el plano 2D vía el store."
status: pending
priority: P2
effort: ~14h
branch: fix/asistente-atasco-generacion
tags: [3d, canvas, editor, r3f, three]
created: 2026-06-24
---

# Editor 3D interactivo (estilo Planner5D)

Permitir seleccionar un mueble dentro del visor 3D navegable, verlo resaltado con un
menú/gizmo, y moverlo / rotarlo / duplicarlo / borrarlo **sin salir del 3D**. Todo cambio
escribe en `useCanvasStore` → el plano 2D se actualiza solo (undo/redo gratis).

## Principio rector

El store es la **única fuente de verdad**. El 3D NUNCA muta geometría localmente: traduce el
gesto del usuario a un `patch` y llama `updateObject` / `removeObject` / `duplicateObjects`.
`docToScene` recalcula la escena en cada cambio del doc (ya memoizada por `doc`). Esto preserva
el invariante 2D↔3D existente y evita un segundo sistema de estado.

## La matemática que NO se puede improvisar (núcleo de la Fase 2)

`doc-to-scene.ts` define el forward. La edición 3D necesita su **inverso exacto**. Toda la
conversión vive en UN módulo puro nuevo (`scene-to-doc.ts`), espejo de `doc-to-scene.ts`:

- Forward posición: `objectCenterPx(obj)` → `XZ = (centroPx − planCenterPx)/pxPerMeter`
  (ver `doc-to-scene.ts:237-262`).
- Forward rotación: `rotationY = −rotation·π/180` (`doc-to-scene.ts:269-271`).
- **Inverso**: dado `[X,Z]` worldspace + el `rotation` actual del objeto (sin cambiar w/h):
  1. `centroPx = [X·pxPerMeter + planCenterPx[0], Z·pxPerMeter + planCenterPx[1]]`
  2. invertir `objectCenterPx` para obtener la esquina `(x,y)`:
     `x = cx − (hw·cos − hh·sin)`, `y = cy − (hw·sin + hh·cos)` con `rad = rotation·π/180`.
- Inverso rotación: `rotation = −rotationY·180/π`, normalizado a `[0,360)`. Como el pivote de
  Konva es la esquina (no el centro), al cambiar `rotation` **también** hay que recomputar
  `(x,y)` para mantener el centro fijo (reusar el inverso de posición con el nuevo `rotation`).

`planCenterPx` y `pxPerMeter` se obtienen del `Scene3D` (ya expuestos: `scene.planCenterPx`,
`scene.pxPerMeter`). El gizmo debe usar **el mismo `center`** con el que se construyó la escena
mostrada, no recalcularlo (ver Riesgo R1).

## Fases

| # | Fase | Estado | Depende de |
|---|------|--------|-----------|
| 1 | Selección + acción flotante (borrar/duplicar) | pending | — |
| 2 | Gizmo de transformación (mover/rotar) | pending | F1 |
| 3 | Panel de propiedades + ocultar paredes | pending | F1 |

F2 y F3 dependen ambas de F1 (selección) pero son **independientes entre sí** y no comparten
archivos de propiedad exclusiva salvo el contenedor de selección creado en F1 (extensión
aditiva, no reescritura). Se pueden hacer en serie o en paralelo controlado.

## Propiedad de archivos por fase

| Archivo | F1 | F2 | F3 |
|---|----|----|----|
| `src/components/canvas/3d/use-3d-selection.ts` (NUEVO) | crea | lee | lee |
| `src/components/canvas/3d/furniture-layer.tsx` | modifica (onClick+outline) | — | modifica (filtra hidden) |
| `src/components/canvas/3d/object-floating-menu.tsx` (NUEVO) | crea | añade botones Mover/Rotar | — |
| `src/components/canvas/3d/plan-3d-view.tsx` | modifica (cablea selección) | modifica (monta gizmo) | modifica (cablea panel) |
| `src/components/canvas/3d/plan-3d-overlay.tsx` | modifica (estado selección) | — | modifica (panel propiedades) |
| `src/canvas/3d/scene-to-doc.ts` (NUEVO) | — | crea | — |
| `src/components/canvas/3d/transform-gizmo.tsx` (NUEVO) | — | crea | — |
| `src/components/canvas/3d/object-properties-panel.tsx` (NUEVO) | — | — | crea |
| `src/components/canvas/3d/walls-layer` (Walls en plan-3d-view) | — | — | modifica (toggle hidden) |

**Conflicto controlado:** `plan-3d-view.tsx` lo tocan las 3 fases. Si se paralelizan F2/F3, una
sola fase es dueña de `plan-3d-view.tsx` y la otra expone su pieza como prop/children que la dueña
cablea. Recomendación: **serie F1→F2→F3** para evitar el merge en ese archivo.

## Criterios de aceptación globales

- [ ] Clic izquierdo en un mueble 3D lo resalta y abre menú flotante anclado sobre él.
- [ ] Borrar quita el objeto del 3D **y** del 2D (un solo `removeObject`).
- [ ] Duplicar crea copia con offset, visible en ambas vistas.
- [ ] Mover con gizmo: al soltar, el objeto queda en la nueva posición y el 2D coincide (≤1 px de error de ida y vuelta en test puro).
- [ ] Rotar con gizmo: el `rotation` del doc cambia y el centro del objeto NO se desplaza.
- [ ] Panel de propiedades edita Width/Height/Angle por input numérico → `updateObject`.
- [ ] Toggle de pared oculta/muestra ese muro en el 3D sin borrarlo del doc.
- [ ] Orbitar sigue funcionando: el gizmo NO secuestra el ratón cuando no se arrastra.
- [ ] `npm run test:ci` verde; sin regresiones en los tests de `doc-to-scene`.

## Riesgos transversales

- **R1 — Deriva del origen de escena.** `planCenterPx` = centro del bbox de TODOS los objetos
  (`doc-to-scene.ts:215-228`). Mover un mueble cambia ese bbox → el origen se desplaza → el resto
  de objetos "saltan". Mitigación: la conversión inversa usa el `planCenterPx` de la escena
  **previa al cambio** (el mostrado). Tras el `updateObject`, `docToScene` recomputa el centro;
  si el salto es perceptible, evaluar congelar el origen durante una sesión de arrastre. Cubrir
  con test: mover 1 objeto en un doc de 3+ objetos y verificar que los demás no cambian su `x,y`.
- **R2 — Gizmo vs OrbitControls.** `TransformControls` debe deshabilitar `OrbitControls`
  mientras se arrastra (`dragging-changed`). `OrbitControls` ya tiene `makeDefault`
  (`plan-3d-view.tsx:310`), que es justo el mecanismo que `TransformControls` de drei usa para
  encontrarlo y silenciarlo. Verificar en navegador.
- **R3 — Recorte de muros tapa el clic.** `Walls` oculta por frame el muro frontal
  (`plan-3d-view.tsx:42-50`). Un mueble seleccionado puede quedar tras un muro visible; no
  bloquea el clic (el muro se oculta al orbitar) pero sí el gizmo. Aceptable en MVP.
- **R4 — Placeholder vs glTF.** El raycast de R3F golpea el mesh real. En `FurnitureModel` el
  glTF está anidado en 3 `<group>` (`furniture-layer.tsx:93-100`); el `onClick` debe ir en el
  grupo raíz para que `e.object` no sea una sub-malla suelta. El `sourceId` se propaga desde el
  `item.id` (= id del objeto 2D), ya disponible.
- **R5 — `useGLTF`/Suspense.** El menú flotante se posiciona proyectando el centro 3D a pantalla;
  hacerlo en `useFrame` (no en render) para no romper con Suspense ni con la cámara orbital.

## Archivos de referencia (verificados)

- Visor: `src/components/canvas/3d/plan-3d-view.tsx` (Canvas, OrbitControls:310, Walls:33-74).
- Muebles: `src/components/canvas/3d/furniture-layer.tsx` (FurnitureModel:46, group raíz:93).
- Overlay: `src/components/canvas/3d/plan-3d-overlay.tsx` (store en vivo:52-54, patrón wallMenu:55-76).
- Forward puro: `src/canvas/3d/doc-to-scene.ts` (objectCenterPx:237, planPointToXZ:255, rotation2DToY:269).
- Store: `src/canvas/canvas-store.ts` (updateObject:110, removeObject:122, duplicateObjects:136).
- Tipos: `src/canvas/types.ts` (StructObj:68, color:98).
- Escala: `src/canvas/scale.ts` (pxToMeters:21, metersToPx:26, effectiveHeightM:187).
- drei 10.7.7 (TransformControls disponible). Tests en `tests/canvas/3d/`. Runner: vitest.

## Preguntas abiertas

1. ¿El gizmo debe limitar el movimiento al plano del suelo (XZ) o permitir elevar en Y? MVP: solo XZ.
2. ¿"Duplicar" en 3D debe seleccionar la copia (como en 2D, store:149) o mantener selección en el original? Propuesta: seleccionar la copia.
3. ¿Snapping/colisiones al mover en 3D? Fuera de scope; YAGNI por ahora.
4. ¿El panel de propiedades reusa los inputs/format de `scale.ts` (`formatObjectSize3d`) o son inputs crudos en cm? Propuesta: inputs en cm, formateo con helpers existentes.
