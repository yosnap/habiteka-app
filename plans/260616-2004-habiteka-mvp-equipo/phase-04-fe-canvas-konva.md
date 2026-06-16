# F4 — Canvas (Konva) (Rol FE/Frontend)

## Context Links
- Arquitectura: [docs/system-architecture.md](../../docs/system-architecture.md) (§3 canvas, §4 fases)
- Flujo: [docs/canva-flow.md](../../docs/canva-flow.md)
- Design system/wireframes (F1): `docs/ux/wireframes.md`, `docs/ux/design-system.md`
- Modelo `CanvasState` (F2): `prisma/schema/project-canvas.prisma`
- Plan general: [plan.md](plan.md)

## Overview
- **Rol primario:** FE/Frontend
- **Prioridad:** P1
- **Estado:** Planificado
- **Depende de:** F1 (tokens/wireframes), F2 (Server Action Project + modelo CanvasState)
- **Paralela con:** F5 (IA agente)
- **Descripción:** Canvas con Konva 10.3 + react-konva: imagen de origen como capa base, dibujo a mano alzada, objetos estructurales editables/seleccionables (muros, ventanas, puertas), selección de zonas para feedback (Fase 4), drag&drop de productos del marketplace, serialización del estado a JSONB y toolbar de herramientas. Integra tokens shadcn/Tailwind v4.

## Key Insights
- react-konva: `Stage > Layer > {Image, Line, Rect, Group, Transformer}`. Dibujo libre = `Line` con array `points` que crece en `mousemove`/`touchmove`.
- **Serialización:** mantener el estado en React (array de objetos tipados) y persistir ese array a `CanvasState.data` (jsonb). NO usar `stage.toJSON()` (acopla a internals de Konva y pierde metadatos de dominio). React-state→JSONB es la fuente de verdad (KISS, desacopla del render).
- Konva es client-only → componente con `"use client"` y carga dinámica sin SSR (evita "window is not defined").
- Selección/transform: `Transformer` adjunto al nodo seleccionado; selección de zona (Fase 4) usa rect de marquesina → coords normalizadas guardadas en `Iteration.zone`.
- Capas separadas por propósito: imagen base, trazos a mano, objetos estructurales, productos marketplace, overlay de selección → re-render aislado y orden z claro.

## Requirements
**Funcionales**
- Cargar imagen de origen como capa base escalada al stage.
- Dibujo a mano alzada (pincel) con grosor/color configurables.
- Crear/editar/mover/redimensionar/eliminar objetos: muro, ventana, puerta (tipados).
- Selección de objeto (click) y selección de zona rectangular (marquesina) para feedback.
- Drag&drop de producto del marketplace al canvas (capa productos).
- Serializar estado a JSONB y rehidratar al abrir proyecto.
- Toolbar: seleccionar, pincel, muro, ventana, puerta, zona, borrar, deshacer/rehacer.

**No funcionales**
- 60fps en stage típico (< ~500 nodos); capas separadas para minimizar re-render.
- Estado serializado versionado (`schemaVersion`) para migración futura.
- Componentes < 200 líneas: dividir por herramienta/capa (DRY).
- Accesible: toolbar navegable por teclado, foco visible (specs F1).

## Architecture
**Árbol de componentes:**
```
src/app/(app)/projects/[id]/page.tsx     # RSC: carga proyecto + CanvasState
  └─ CanvasWorkspace (client, dynamic, ssr:false)
       ├─ CanvasToolbar            # herramientas (shadcn Button/Toggle)
       └─ Stage (react-konva)
            ├─ Layer: BaseImageLayer        # imagen origen
            ├─ Layer: FreehandLayer         # Line[] trazos
            ├─ Layer: StructureLayer        # muros/ventanas/puertas + Transformer
            ├─ Layer: ProductLayer          # drag&drop marketplace
            └─ Layer: SelectionOverlay      # marquesina de zona (Fase 4)
```
**Modelo de estado (tipado, → JSONB):**
```
CanvasDoc { schemaVersion, baseImage{url,w,h},
  strokes: Stroke[]{points[],color,width},
  objects: StructObj[]{id,kind:'wall'|'window'|'door',x,y,w,h,rotation},
  products: ProductRef[]{id,marketplaceItemId,x,y},
  selection?: { objectId | zone{x,y,w,h normalizadas} } }
```
**Data flow:** RSC lee `CanvasState.data` → hidrata `CanvasDoc` en store cliente → usuario edita → debounce → Server Action (F2) persiste a jsonb. Zona seleccionada → emite `CanvasZone` (contrato F0) a chat/agente (consumido en F6/F7). Drag&drop producto → el canvas recibe un `ProductDrop` (contrato `product-drop-payload` de F0, emitido por F10) y lo materializa como `ProductRef` en `products`.

## Related Code Files
**Crear (owner FE):**
- `src/canvas/types.ts` — tipos `CanvasDoc`, `StructObj`, `Stroke`, `ProductRef`
- `src/canvas/canvas-store.ts` — estado cliente (objetos, selección, undo/redo)
- `src/canvas/serialize.ts` — `CanvasDoc` ⇄ jsonb (con `schemaVersion`)
- `src/canvas/use-freehand.ts` — hook de dibujo a mano alzada
- `src/canvas/use-selection.ts` — selección objeto + zona (marquesina)
- `src/components/canvas/canvas-workspace.tsx` — orquestador (dynamic, ssr:false)
- `src/components/canvas/canvas-toolbar.tsx` — toolbar de herramientas
- `src/components/canvas/layers/base-image-layer.tsx`
- `src/components/canvas/layers/freehand-layer.tsx`
- `src/components/canvas/layers/structure-layer.tsx` — objetos + Transformer
- `src/components/canvas/layers/product-layer.tsx` — drag&drop
- `src/components/canvas/layers/selection-overlay.tsx` — marquesina zona
- `src/app/(app)/projects/[id]/page.tsx` — RSC carga + hidratación

**Modificar:** ninguno fuera de globs owner.
**Sin solape:** chat/entregables UI = F6 (`src/components/chat/**`, `src/components/deliverables/**`). Server Actions = BE (F2). Catálogo marketplace = F10.

## Implementation Steps
1. Tipos `CanvasDoc` y derivados en `src/canvas/types.ts` (incluye `schemaVersion`).
2. Store cliente con objetos/selección/undo-redo en `canvas-store.ts`.
3. `CanvasWorkspace` con carga dinámica `ssr:false`; Stage + 5 Layers.
4. `BaseImageLayer`: cargar imagen origen, escalar al stage.
5. `use-freehand` + `FreehandLayer`: dibujo con `Line` (points en mousemove).
6. `StructureLayer`: crear muro/ventana/puerta (Rect/Group tipado), seleccionar y `Transformer` para resize/rotate.
7. `use-selection` + `SelectionOverlay`: click-select objeto y marquesina de zona → coords normalizadas.
8. `ProductLayer`: aceptar drop de producto, añadir `ProductRef`.
9. `serialize.ts`: `CanvasDoc`⇄jsonb; persistir con debounce vía Server Action (F2); rehidratar en RSC.
10. `CanvasToolbar`: botones shadcn por herramienta + deshacer/rehacer; tokens F1.

## Todo List
- [ ] Tipos `CanvasDoc` + store cliente
- [ ] CanvasWorkspace dynamic ssr:false con 5 capas
- [ ] Imagen de origen escalada en capa base
- [ ] Dibujo a mano alzada (Line)
- [ ] Objetos muro/ventana/puerta editables + Transformer
- [ ] Selección de objeto y de zona (marquesina)
- [ ] Drag&drop de productos en capa producto
- [ ] Serialización ⇄ JSONB + rehidratación + debounce persist
- [ ] Toolbar shadcn + undo/redo con tokens F1

## Success Criteria
- Imagen de origen se carga y dibujo libre traza fluido (≥30fps perceptible).
- Crear/mover/redimensionar/borrar muro/ventana/puerta funciona.
- Selección de zona produce coords normalizadas reutilizables por feedback.
- Estado persiste a jsonb y rehidrata idéntico al recargar.
- Drag&drop añade producto y queda en el estado serializado.
- Toolbar accesible por teclado, usa tokens del design system.

## Risk Assessment
| Riesgo | Prob×Imp | Mitigación |
|---|---|---|
| Konva en SSR → "window is not defined" | Alto×Alto | `dynamic(import, {ssr:false})` + `"use client"` |
| `stage.toJSON()` acopla a internals y pierde dominio | Med×Alto | Fuente de verdad = React-state tipado → jsonb propio |
| Re-render global por capa única | Med×Med | 5 capas separadas por propósito |
| Drift de schema jsonb entre F4 y F2 | Med×Alto | `schemaVersion` + tipos compartidos en `src/canvas/types.ts` |
| Persist en cada trazo satura DB | Med×Med | Debounce + persist por lote |
| Coords de zona no casan con `Iteration.zone` (F7) | Med×Alto | Normalizar 0..1; contrato de zona acordado con IA |

## Security Considerations
- Sin secrets en cliente; persistencia solo vía Server Actions con guard (F2).
- Validar `CanvasDoc` en server antes de guardar (no confiar en payload cliente).
- `affiliateUrl` de productos se resuelve server-side (F10); canvas solo referencia `marketplaceItemId`.
- Tamaño de imagen origen limitado (evitar payload jsonb excesivo).

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor), unit/Vitest sobre lógica pura (sin render Konva real):
- **Serialización round-trip**: `CanvasDoc → jsonb → CanvasDoc` devuelve el documento idéntico (incl. `schemaVersion`, strokes, objetos, productos). Rojo sin `serialize.ts`.
- **Selección de zona → CanvasZone normalizada**: una marquesina en píxeles produce un `CanvasZone` con coords 0–1 correctas; verde al implementar `use-selection`.
- **Drop de ProductDrop → ProductRef**: aplicar un `ProductDrop` (contrato F0) al store materializa un `ProductRef` en `products` con `marketplaceItemId` y posición. Rojo sin la lógica de materialización.
- **Mock:** se mockea/aísla el render Konva (Stage/Layer) — el canvas es client-only; se testea el store y los transformadores de datos, NO el pintado. Lógica de serialización/selección/drop NO se mockea.

## Next Steps
- F6 (FE chat/entregables) monta canvas dentro del layout de 3 zonas y renderiza sello/disclaimer.
- F7 (feedback/render) consume zona seleccionada para inpainting/regeneración parcial.
- F10 (marketplace) provee catálogo arrastrable a `ProductLayer`.
