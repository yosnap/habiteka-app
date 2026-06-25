# Fase 3 — Panel de propiedades + ocultar paredes

> Panel inferior (estilo Planner5D) con Width / Height / Angle del objeto seleccionado, inputs
> numéricos → `updateObject`. Botón por pared para ocultar/mostrar (toggle `hidden`), con la capa
> de muros filtrando los ocultos.

## Depende de

Fase 1 (selección) — obligatorio.
Fase 2 (gizmo) — obligatorio para el campo Angle del panel: usa `rotatePatch` de `scene-to-doc.ts`.
Si se implementa sin Fase 2, el campo Angle debe ser de solo lectura hasta que F2 esté disponible.

## Contexto

- `types.ts:68-99` — `StructObj`: `width`, `height`, `rotation`, `color`. **No existe `hidden`**:
  hay que añadirlo (campo opcional aditivo, sin subir `CANVAS_SCHEMA_VERSION`, igual que `color`
  se añadió, `:93-98`).
- `doc-to-scene.ts:381-410` — construcción de muros: cada `WallBox` lleva `sourceId = wall.id`
  (`:406`). Para ocultar, el muro debe propagar su `hidden` al `WallBox` (igual que propaga `color`).
- `plan-3d-view.tsx:33-74` — componente `Walls`: ya recorre `scene.walls`. Filtrar/saltar los
  marcados como `hidden` (o no renderizar su mesh). Cuidado: NO confundir con el recorte por cámara
  (`shouldHideWallXZ`, `:48`), que es `visible` por frame — el `hidden` del usuario es persistente.
- `scale.ts:69` `formatObjectSize3d`, `:55` `formatObjectSize` — formateo de medidas para inputs.
- `canvas-store.ts:110` `updateObject` — un patch por edición.

## Requisitos

### Parte A — Panel de propiedades

1. Cuando hay objeto seleccionado, mostrar panel inferior con: Width, Height (ambos en cm,
   derivados de `width`/`height` px vía `pxPerMeter`), Angle (grados = `rotation`).
2. Editar un input → `updateObject(id, patch)`. Width/Height en cm → px con `metersToPx`
   (`scale.ts:26`) usando el `pxPerMeter` de la escena/doc. Angle directo a `rotation`.
3. El panel refleja en vivo los cambios del store (si el gizmo de Fase 2 mueve el objeto, el panel
   no necesita Angle reactivo más allá de releer el doc).

### Parte B — Ocultar/mostrar paredes

4. Añadir `hidden?: boolean` a `StructObj` (`types.ts`).
5. Propagar `hidden` del muro a su `WallBox` en `doc-to-scene.ts` (igual que `color`, `:406`).
6. `Walls` no renderiza el mesh de un muro `hidden` (o lo deja `visible=false` permanente).
7. UI para alternar: botón por pared. MVP simple: clic derecho en pared ya abre el menú de pintura
   (`plan-3d-overlay.tsx:151-172`); **añadir ahí** un botón "Ocultar/Mostrar" que togglee
   `updateObject(wallId, { hidden: !hidden })`. Reusa el flujo existente (DRY), sin nueva UI de paredes.

## Archivos a modificar

- `src/canvas/types.ts`
  - Añadir `hidden?: boolean` a `StructObj` con comentario (aditivo, como `color`).
- `src/canvas/3d/doc-to-scene.ts`
  - `WallBox`: añadir `hidden?: boolean`.
  - Al construir las cajas del muro (`:405-407`), propagar `...(wall.hidden ? { hidden: true } : {})`.
- `src/components/canvas/3d/plan-3d-view.tsx`
  - **Filtrar `hidden` ANTES de pasar a `<Walls>`** (C4): el componente `Walls` usa un array de
    refs indexado por posición que se construye en el propio componente. Si se filtra dentro de
    `Walls`, el `useFrame` (que itera `walls.length`) y el array de refs pueden desalinearse.
    La forma correcta es filtrar en `Plan3DView`/`RoomMesh` antes de la prop:
    ```tsx
    <Walls walls={scene.walls.filter(w => !w.hidden)} onPick={onPickWall} />
    ```
    Así `Walls` nunca recibe muros ocultos y los índices siempre son consistentes. NO modificar
    el interior de `Walls` para saltar índices.
- `src/components/canvas/3d/plan-3d-overlay.tsx`
  - En el menú contextual de pared, añadir botón Ocultar/Mostrar que togglee `hidden` del muro
    seleccionado (`wallMenu.id`).
  - Montar `<ObjectPropertiesPanel>` cuando hay objeto seleccionado (de Fase 1), cableado a
    `updateObject` y al `pxPerMeter` del doc/escena.

## Archivos a crear

- `src/components/canvas/3d/object-properties-panel.tsx`
  - Presentacional: recibe `object: StructObj`, `pxPerMeter`, `onChange(patch)`.
  - Inputs numéricos Width (cm), Height (cm), Angle (°). Convierte px↔cm con `scale.ts` helpers.
  - Posición: barra inferior fija (como Planner5D), `absolute bottom-0`.

## Pasos de implementación

1. `types.ts`: añadir `hidden?: boolean`.
2. `doc-to-scene.ts`: `WallBox.hidden` + propagación. Test de propagación.
3. `plan-3d-view.tsx`: `Walls` respeta `hidden`.
4. `object-properties-panel.tsx`: inputs + conversiones.
5. `plan-3d-overlay.tsx`: montar panel + botón Ocultar en el menú de pared.
6. Verificación manual: cambiar Width/Height/Angle refleja en 2D y 3D; ocultar pared la quita del
   3D sin borrarla del 2D; mostrar la devuelve.

## Tests a escribir (`tests/canvas/3d/`)

- `doc-to-scene.test.ts` (extender): un muro con `hidden: true` produce `WallBox` con `hidden: true`;
  sin el campo, `WallBox.hidden` ausente/false. El suelo derivado de muros NO cambia por `hidden`
  (ocultar es presentacional, no altera geometría de suelo — verificar `floorPolygonFromWalls`
  sigue usando todos los muros).
- Conversión px↔cm del panel: si se extrae a helper puro, test de ida y vuelta (Width cm →
  `metersToPx` → px → de vuelta a cm) ≤ tolerancia. Si se usan helpers de `scale.ts` directamente,
  basta cubrir el wrapper.

## Riesgos

- **`hidden` vs recorte por cámara.** Son dos mecanismos distintos sobre `visible`. El recorte
  (`shouldHideWallXZ`, `plan-3d-view.tsx:48`) corre cada frame y sobrescribe `mesh.visible`. Si se
  implementa `hidden` como `visible=false`, el `useFrame` lo pisará al frame siguiente. **Mitigación
  correcta**: no renderizar el `<mesh>` del muro `hidden` (filtrar antes del `.map`), así el
  `useFrame` ni lo recorre. Verificar índices de `refs` tras filtrar.
- **`hidden` y el suelo.** El suelo se deriva de `floorPolygonFromWalls(wallsForFloor)`
  (`doc-to-scene.ts:417,443`) usando TODOS los muros `wall`. Ocultar un muro NO debe agujerear el
  suelo. Como `hidden` no se filtra en `wallsForFloor`, el suelo se mantiene — confirmarlo en test.
- **Persistencia.** `hidden` entra en el doc → se serializa y persiste. ¿El usuario espera que una
  pared oculta siga oculta al recargar? Decisión de producto (Pregunta abierta 1). Si no, `hidden`
  debería ser estado de UI (no doc) — pero entonces no es trivial mapearlo por id sin store. MVP:
  persistir en el doc (más simple, reusa `updateObject`); revisar con el usuario.
- **Inputs y NaN.** Validar inputs vacíos/no numéricos antes de `updateObject` (no escribir `NaN`
  en `width`). Clamp a un mínimo razonable (p. ej. > 0).
- **Angle y pivote (BLOQUEANTE si F2 no está lista).** Cambiar `rotation` por input mueve el
  objeto si el pivote es la esquina (Konva). El campo Angle DEBE usar `rotatePatch` de
  `scene-to-doc.ts` (Fase 2) para mantener el centro del objeto fijo. Si F3 se implementa
  antes que F2, el campo Angle debe ser de **solo lectura** hasta que Fase 2 esté disponible.
  No escribir `updateObject(id, { rotation })` directamente desde el panel (desplaza el objeto).
  Orden obligatorio: **F2 antes que F3** para el campo Angle.

## Rollback

`hidden` es aditivo y opcional; docs viejos sin el campo se comportan igual. Revertir = no montar
el panel ni el botón Ocultar, y quitar el filtro de `Walls`. El campo en el tipo puede quedarse
inerte sin efecto.

## Definición de hecho

- Width/Height/Angle editables por input → reflejo en 2D y 3D.
- Ocultar/mostrar pared funciona sin borrar el muro ni agujerear el suelo.
- Tests de propagación de `hidden` y de conversión verdes. Sin regresión en suelo/recorte de cámara.
