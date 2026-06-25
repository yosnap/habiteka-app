# Fase 1 — Selección y acción flotante (mínimo viable)

> Clic izquierdo en un mueble 3D → resaltado + menú flotante (Mover, Rotar, Duplicar, Borrar).
> Borrar y Duplicar funcionan ya en esta fase. Mover/Rotar quedan como botones inertes que
> activa la Fase 2. Sin matemática inversa todavía.

## Contexto

- `furniture-layer.tsx:46-101` — `FurnitureModel`: grupo raíz en `:93` con `item.id` disponible.
- `furniture-layer.tsx:105-112` — `FurniturePlaceholder` (kinds sin glTF): mesh único.
- `plan-3d-view.tsx:202-316` — `Plan3DView`: aquí se monta `FurnitureLayer` (`:299`).
- `plan-3d-overlay.tsx:55-76` — patrón existente de menú contextual anclado a coords de pantalla
  (`wallMenu`): copiar el enfoque para el menú del objeto.
- `canvas-store.ts:122` `removeObject`, `:136` `duplicateObjects`.

## Requisitos

1. Estado de selección 3D: el `sourceId` (= id del objeto 2D) del mueble seleccionado, o null.
   Vive en React, NO en el store (es UI efímera, igual que `selection` no entra en historial).
2. Clic izquierdo sobre un mueble → fija selección + resalta (outline o tinte de color).
3. Clic en vacío (suelo/fondo) → deselecciona.
4. Menú flotante anclado sobre el objeto seleccionado, proyectando su centro 3D a píxeles de
   pantalla. Botones: Mover, Rotar, Duplicar, Borrar.
5. Borrar → `removeObject(id)` + limpiar selección. Duplicar → `duplicateObjects([id])` +
   seleccionar la copia devuelta.
6. Mover/Rotar: por ahora sin efecto (placeholder para Fase 2); deshabilitados visualmente o con
   un `onActivateMode` que aún no hace nada.

## Archivos a crear

- `src/components/canvas/3d/use-3d-selection.ts`
  - Hook puro de React: `{ selectedId, select(id), clear(), mode, setMode }`.
  - `mode: 'none' | 'translate' | 'rotate'` (Fase 2 lo usa; en F1 solo 'none').
  - Sin dependencias de Three: testeable como lógica.
- `src/components/canvas/3d/object-floating-menu.tsx`
  - Recibe `screenX, screenY` (px) + callbacks `onMove, onRotate, onDuplicate, onDelete, onClose`.
  - Barra de iconos absoluta (mismo estilo visual que el `wallMenu` de `plan-3d-overlay.tsx:151-172`).
  - Componente "tonto": no calcula posición, la recibe ya proyectada.

## Archivos a modificar

- `src/components/canvas/3d/furniture-layer.tsx`
  - Pasar `selectedId` y `onSelect(id)` a `FurnitureLayer` → `FurnitureModel` / `FurniturePlaceholder`.
  - `onClick` en el **grupo raíz** (`:93`) y en el mesh del placeholder (`:107`):
    `e.stopPropagation(); onSelect(item.id)`.
  - Resaltado: si `item.id === selectedId`, aplicar outline. KISS: cambio de material/emisivo
    o `<Outlines>` de drei — pero `<Outlines>` debe envolver el `<Clone>` interno (no el grupo
    raíz, que no tiene geometría directa). Alternativa más robusta: `traverse` en el grupo raíz
    para setear `emissive` en todos los submeshes del glTF. Para el placeholder (caja única), sí
    se puede usar `<Outlines>` directamente. Evitar postprocessing.
- `src/components/canvas/3d/plan-3d-view.tsx`
  - Aceptar props nuevas `selectedId`, `onSelect`, `onDeselect`, y pasarlas a `FurnitureLayer`.
  - `onPointerMissed` en `<Canvas>` → `onDeselect()` (clic en vacío deselecciona; API estándar R3F).
  - Proyección centro→pantalla: un componente interno `<ScreenAnchor item3DCenter onScreen>` que
    en `useFrame` proyecta el centro del objeto seleccionado con `vector.project(camera)` (NO
    `camera.project` — esa API no existe en Three.js) y reporta px al overlay (vía callback en
    estado throttled, o ref + rAF). Necesario para anclar el menú.
    - Condición "detrás de la cámara": `v.z >= 1.0` (perspectiva), NO `z < 0`. Si se cumple,
      ocultar el menú.
- `src/components/canvas/3d/plan-3d-overlay.tsx`
  - Montar `use-3d-selection`. Renderizar `<ObjectFloatingMenu>` cuando hay selección, con las
    coords de pantalla que reporta `Plan3DView`.
  - Cablear `onDelete`/`onDuplicate` a `removeObject`/`duplicateObjects` del store
    (`useCanvasStore` ya está montado, `:52-53`; añadir los selectores que falten).
  - Tras duplicar, fijar selección al id devuelto.
  - **Escape key con prioridad** (RR3): el `useMountEffect` del overlay ya cierra el overlay con
    Escape (`:60-65`). Al añadir selección/modos, modificarlo para que si `mode !== 'none'`,
    Escape cancele el modo (no cierre el overlay): `if (mode !== 'none') { setMode('none');
    e.stopPropagation(); return; }`. Solo si `mode === 'none'`, Escape cierra el overlay.

## Pasos de implementación

1. Crear `use-3d-selection.ts` con el hook y su tipo `Mode`. Test puro primero.
2. Crear `object-floating-menu.tsx` (presentacional, 4 iconos + cerrar).
3. En `furniture-layer.tsx`: props `selectedId`/`onSelect`; `onClick` con `stopPropagation` en
   grupo raíz y placeholder; outline condicional con `<Outlines>` de drei.
4. En `plan-3d-view.tsx`: props de selección; `onPointerMissed`; componente `ScreenAnchor`
   (useFrame + `camera.project`) que entrega `{x,y}` en px al caller mientras haya selección.
5. En `plan-3d-overlay.tsx`: montar hook, render del menú con las coords, cablear store.
6. Verificación manual: seleccionar, borrar (desaparece en 2D y 3D), duplicar (aparece copia).

## Tests a escribir (`tests/canvas/3d/`)

- `use-3d-selection.test.ts`: select fija id; clear lo borra; setMode cambia modo; seleccionar
  otro reemplaza; no hay efectos colaterales sobre el doc.
- (Render/interacción 3D: difícil de testear sin WebGL; cubrir con verificación manual. NO mockear
  WebGL — regla del proyecto: sin mocks para satisfacer un check.)

## Riesgos

- **R4 (raycast).** `onClick` en sub-malla suelta del glTF → poner el handler en el grupo raíz y
  `stopPropagation` para que no escale a varios meshes. Verificar que el placeholder (caja única)
  también selecciona.
- **Proyección del ancla.** Si el centro proyectado queda fuera de pantalla (objeto tras la
  cámara), ocultar el menú (`z < 0` tras `camera.project`). No anclar a coords negativas.
- **Throttle.** Reportar la posición del ancla cada frame a React causaría re-render por frame.
  Mitigar: actualizar solo si el delta > N px, o escribir a un ref y posicionar el menú por estilo
  imperativo. Decidir en implementación; preferir lo simple que no tire el FPS.

## Rollback

Las props nuevas son aditivas y opcionales. Revertir = quitar el render del menú en el overlay y
las props de selección; el visor vuelve al comportamiento actual sin tocar `doc-to-scene`.

## Definición de hecho

- Seleccionar resalta; clic en vacío deselecciona; Borrar y Duplicar reflejan en 2D y 3D.
- Mover/Rotar presentes pero inertes. Tests del hook verdes. FPS sin regresión perceptible.
