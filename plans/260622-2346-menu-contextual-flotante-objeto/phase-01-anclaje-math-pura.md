# Fase 1 — Anclaje del menú: math pura mundo→pantalla + bbox

## Contexto
- El viewport vive en `canvas-stage.tsx:64` (`view = {scale, x, y}`).
- Objetos `StructObj` con `x/y/width/height/rotation` en `src/canvas/types.ts`.
- Math de selección existente: `src/canvas/selection-math.ts` (revisar antes de crear helper nuevo).

## Requisitos
Lógica PURA y testeable (sin React/Konva) que, dada la selección de objetos + el view, devuelva
la posición en pantalla donde anclar el menú flotante y su visibilidad.

## Decisión previa (predict): preferir el AABB nativo de Konva
Antes de implementar `selectionAabb` a mano, **probar `node.getClientRect({ relativeTo: stage })`**
de Konva, que ya devuelve el bbox en coordenadas de mundo respetando la rotación. Si es fiable, el
componente lo usa directamente y este helper queda solo como contrato puro testeable / fallback. Si
hay discrepancias con el pivote, usar el helper a mano (criterio AABB de `doc-to-scene`).

## Archivos a crear/modificar
- **Crear** `src/canvas/floating-menu-anchor.ts` (kebab-case):
  - `selectionAabb(objects: StructObj[], ids: string[]): {x,y,width,height} | null` — AABB en
    coordenadas de MUNDO de los ids seleccionados. **Respetar `rotation`**: usar el mismo criterio
    AABB que `doc-to-scene` (calcular las 4 esquinas rotadas y tomar min/max), para no reintroducir
    el desajuste de pivote ya corregido. Si no hay ids → `null`. (Fallback testeable de
    `getClientRect`; el contrato y los tests valen para ambos caminos.)
  - `worldToScreen(point, view): {x,y}` — `screenX = x*view.scale + view.x`.
  - `anchorPosition(aabb, view, viewport, menuSize): {x,y,placement:'top'|'bottom'}` — centra el
    menú horizontalmente sobre el AABB; lo coloca encima (con un gap) y, si no cabe arriba dentro de
    `viewport` (área visible del canvas), debajo; clamp horizontal para no salirse.
- **Si ya existe** un helper de bbox en `selection-math.ts`, reusarlo en vez de duplicar.

## Tests
- `src/canvas/floating-menu-anchor.test.ts`:
  - AABB de un objeto sin rotación, con rotación 90°, y multi-objeto.
  - `worldToScreen` con view por defecto y con zoom+pan.
  - `anchorPosition`: caso normal (arriba), caso sin espacio arriba (cae abajo), clamp horizontal
    en los bordes.

## Validación
- `bunx vitest run src/canvas/floating-menu-anchor.test.ts` verde.
- `bunx tsc` sin errores.
