# Fase 2 — Gizmo de transformación (mover / rotar)

> Activar "Mover" en el menú → `<TransformControls mode="translate">` sobre el objeto.
> Al soltar, convertir la posición worldspace de vuelta a coords del canvas 2D → `updateObject`.
> "Rotar" → `mode="rotate"` → `updateObject(id, { rotation })`. Toda la conversión es PURA y
> testeada (`scene-to-doc.ts`), espejo exacto de `doc-to-scene.ts`.

## Depende de

Fase 1 (selección + `mode` en `use-3d-selection`).

## Contexto matemático (leer antes de codificar)

Forward en `doc-to-scene.ts`:
- `objectCenterPx(obj)` (`:237-246`): centro px con pivote en la esquina (Konva).
- `planPointToXZ` (`:255-262`): `XZ = (centroPx − planCenterPx)/pxPerMeter`.
- `rotation2DToY` (`:269-271`): `rotationY = −rotation·π/180`.
- La escena expone `scene.planCenterPx` (`:463`) y `scene.pxPerMeter` (`:462`).

El gizmo recibe del objeto 3D su `position` (centro en metros, plano XZ) y su `rotation.y`. El
inverso debe producir el `patch` `{ x, y }` (posición) o `{ rotation, x, y }` (rotación, porque
mover el ángulo con pivote-esquina desplaza el centro y hay que recolocarlo).

> **IMPORTANTE (C3):** El grupo raíz de `FurnitureModel` (`:93`) tiene siempre `position.y = 0`
> (no `item.center[1]`). El desplazamiento vertical real está en el grupo interior (`:96`).
> El gizmo SOLO debe leer `.position.x` y `.position.z` del Object3D controlado. Nunca usar
> `.position.y` del grupo raíz para ningún cálculo.

> **IMPORTANTE:** `translatePatch` y `rotatePatch` necesitan el `StructObj` del store (para
> `rotation`, `width`, `height` en píxeles y grados), NO el `FurnitureItem` de la escena (que
> tiene `size` en metros y `rotationY` en radianes). Al seleccionar un objeto, leer el `StructObj`
> con `useCanvasStore.getState().doc.objects.find(o => o.id === selectedId)`.

## Requisitos

1. Cuando `mode === 'translate'` y hay selección: montar `TransformControls` en modo translate,
   anclado al objeto 3D seleccionado, **restringido al plano XZ** (sin eje Y → no se eleva).
2. Cuando `mode === 'rotate'`: `TransformControls` en modo rotate, **solo eje Y** (giro en planta).
3. Mientras se arrastra el gizmo, `OrbitControls` se desactiva (evento `dragging-changed`).
4. Al soltar (`mouseUp` / fin de drag): leer la transform final → convertir a doc → `updateObject`.
   No actualizar el doc en cada frame del arrastre (un solo commit al soltar = un solo paso de
   historial, sin inundar undo/redo).

## Archivos a crear

- `src/canvas/3d/scene-to-doc.ts` (PURO, sin React/Three)
  - `sceneXZToPlanCenterPx([x,z], planCenterPx, pxPerMeter): [cx, cy]` — inverso de `planPointToXZ`.
  - `planCenterPxToCorner(cx, cy, obj): { x, y }` — invierte `objectCenterPx` para un `rotation`/
    `width`/`height` dados: `x = cx − (hw·cos − hh·sin)`, `y = cy − (hw·sin + hh·cos)`.
  - `rotationYToDoc(rotationY): number` — `(−rotationY·180/π)` normalizado a `[0,360)`.
  - `translatePatch(obj, [x,z], scene): { x, y }` — compone los dos primeros: dada la nueva
    posición XZ y el `obj` actual (su rotation/width/height) devuelve la nueva esquina.
  - `rotatePatch(obj, rotationY, scene): { rotation, x, y }` — fija el nuevo `rotation`, mantiene
    el **centro** del objeto (recalcula `x,y` con el nuevo ángulo desde el centro previo). El
    centro previo se obtiene con `objectCenterPx(obj)` (importable de `doc-to-scene.ts`).
- `src/components/canvas/3d/transform-gizmo.tsx`
  - Envuelve `<TransformControls>` de drei. Props: `objectRef` (o `object`), `mode`, `onCommit(patch)`.
  - Restringe ejes según `mode`:
    - translate → `showY={false} showXY={false} showYZ={false}` (ocultar eje Y + handles de los
      planos que involucran Y). Solo con `showY={false}` el usuario puede seguir elevando el objeto
      arrastrando los handles de plano XY/YZ visibles. Si `showXY`/`showYZ` no están disponibles
      como props directas de drei en v10.7.7, acceder vía `ref.current.showXY = false` tras montar.
    - rotate → `showX={false} showZ={false}` (solo eje Y visible = giro en planta).
  - `onMouseUp` / listener `dragging-changed`: cuando termina el drag, leer la transform del objeto
    controlado y llamar `onCommit`.

## Archivos a modificar

- `src/components/canvas/3d/object-floating-menu.tsx`
  - Botones Mover/Rotar ahora llaman `onMove`/`onRotate` → `setMode('translate'|'rotate')`.
  - Indicar visualmente el modo activo. Un botón "Listo"/Escape vuelve a `mode='none'`.
- `src/components/canvas/3d/furniture-layer.tsx`
  - Exponer una `ref` al grupo raíz del objeto seleccionado (callback ref por id), para que el
    gizmo tenga el `Object3D` a controlar. Alternativa más simple: que el gizmo localice el objeto
    por `name = item.id` con `scene.getObjectByName`. Elegir la que menos acople (preferir name).
  - Al renderizar el grupo raíz de cada mueble (`:93`), añadir `name={item.id}`.
- `src/components/canvas/3d/plan-3d-view.tsx`
  - Montar `<TransformGizmo>` dentro del `<Canvas>` cuando `mode !== 'none'` y hay selección.
  - `onCommit(patch)` → propagar al overlay (que llama `updateObject`).
  - `OrbitControls` ya tiene `makeDefault` (`:310`): drei `TransformControls` lo silencia solo
    durante el drag. Verificar.
- `src/components/canvas/3d/plan-3d-overlay.tsx`
  - Recibir `onCommit` desde `Plan3DView` → `updateObject(selectedId, patch)`.
  - Un único `updateObject` por gesto = un paso de historial.

## Pasos de implementación

1. `scene-to-doc.ts` con las 5 funciones puras. **Tests primero** (round-trip).
2. `transform-gizmo.tsx`: wrapper de `TransformControls`, restricción de ejes, `onCommit` al soltar.
3. `furniture-layer.tsx`: `name={item.id}` en el grupo raíz.
4. `plan-3d-view.tsx`: montar el gizmo según `mode`; localizar el objeto por name; cablear `onCommit`.
5. `object-floating-menu.tsx`: activar Mover/Rotar.
6. `plan-3d-overlay.tsx`: `onCommit` → `updateObject`.
7. Verificación manual: mover un mueble, soltar, abrir el 2D → coincide. Rotar → ángulo correcto y
   el centro no salta. Orbitar sigue funcionando.

## Tests a escribir (`tests/canvas/3d/scene-to-doc.test.ts`)

- **Round-trip posición**: para varios objetos (rotation 0, 45, 90, 180; con/sin offset de plano),
  `doc → docToScene → translatePatch(scene.furniture[i] worldspace) → doc'` y verificar que
  `x,y` vuelven al original (≤1e-6). Reusar el `doc()` helper de `doc-to-scene.test.ts`.
- **Round-trip rotación**: `rotationYToDoc(rotation2DToY(deg)) === deg` para 0/45/90/180/270/359.
- **Centro fijo en rotación**: tras `rotatePatch`, `objectCenterPx(objNuevo) === objectCenterPx(objViejo)`
  (≤1e-6). Este es el invariante que evita el "salto" al rotar.
- **Inverso de planCenterPx**: `sceneXZToPlanCenterPx(planPointToXZ(...)) === objectCenterPx(...)`.
- **Normalización de ángulo**: `rotationYToDoc` devuelve siempre `[0,360)`.

## Riesgos

- **R1 (deriva de origen).** El inverso usa `scene.planCenterPx` de la escena MOSTRADA. Tras el
  commit, `docToScene` recalcula el centro desde el bbox nuevo. Si el objeto movido era extremo
  del bbox, el origen se desplaza y los demás objetos se reposicionan respecto a cámara. Test:
  mover 1 de 3+ objetos y verificar que el `x,y` de los OTROS en el doc no cambia (la deriva es
  visual por re-centrado de cámara, no de datos). Documentar; si molesta en navegador, congelar
  `planCenterPx` durante la sesión de edición (fuera de scope MVP).
- **R2 (gizmo vs órbita).** Confirmar que `dragging-changed` desactiva `OrbitControls`. Si no, usar
  el patrón `useThree().controls` + `enabled=false` en drag. `makeDefault` en `:310` debería bastar.
- **flipX y swap de ejes.** `furniture-layer.tsx:61-86` aplica `flipX` (escala −1) y un giro de
  modelo (`modelRot`) ANIDADO bajo el grupo raíz. El gizmo controla el **grupo raíz** (que lleva
  `position` + `rotationY` del item, `:94`), NO el modelo interno. Así la rotación que lee el gizmo
  es la del item, no la del modelo → la conversión es directa. Verificar que `name` va en `:94`.
- **Snapping del gizmo.** `TransformControls` puede traer snap. Mantener desactivado en MVP (KISS).
- **rotate en grados vs rad.** El doc usa GRADOS (`StructObj.rotation`); Three usa rad. Toda
  conversión vive en `scene-to-doc.ts`; ningún componente debe convertir a mano.

## Rollback

`scene-to-doc.ts` es nuevo y aislado. El gizmo se monta condicionalmente. Revertir = no montar el
gizmo y dejar Mover/Rotar inertes (estado Fase 1). `doc-to-scene.ts` no se toca.

## Definición de hecho

- Mover/Rotar producen un `updateObject` correcto, verificado por round-trip ≤1e-6 en tests puros.
- El centro no salta al rotar. Orbitar funciona. Un gesto = un paso de undo.
