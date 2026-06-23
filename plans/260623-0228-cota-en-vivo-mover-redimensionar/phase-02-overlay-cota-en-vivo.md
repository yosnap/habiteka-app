# Fase 2 — Overlay de cota en vivo en mover/redimensionar (UI)

## Contexto
- `structure-layer.tsx`: `<Group draggable>` por objeto + `<Transformer>`. Hoy solo `onDragEnd`
  (:104) y `onTransformEnd` (:128) escriben al store.
- Patrón de cota: `draw-wall-overlay.tsx` (`Label`+`Tag`+`Text`, mismos colores/fuente).
- Helpers: `formatObjectSize` (tamaño), `neighborGaps` (fase 1), `selectionAabb`.

## Requisitos
Mostrar la cota EN VIVO durante el gesto, sin tocar el store hasta soltar.

## Archivos a crear/modificar
- **Modificar** `src/components/canvas/layers/structure-layer.tsx`:
  - Estado local transitorio `live` (p. ej. `{ kind:'move'|'resize', rect: WorldRect } | null`).
  - `onDragStart`/`onDragMove`: calcular el AABB actual del nodo arrastrado (de `e.target.x()/y()` +
    tamaño/rotación del objeto) y guardarlo en `live` con kind 'move'. En `onDragEnd`: `live=null`
    (además de lo que ya hace).
  - `onTransform` (durante el resize): calcular tamaño actual (`o.width*scaleX`, `o.height*scaleY`)
    y guardarlo en `live` con kind 'resize'. `onTransformEnd`: `live=null`.
  - Multiselección: medir el conjunto con `selectionAabb` (ya se mueve en bloque hoy).
- **Crear** `src/components/canvas/layers/live-dimension-overlay.tsx` (o un `Group` inline si es
  pequeño — preferir componente para mantener structure-layer por debajo del límite de líneas):
  - Props: `live`, `objects`, `scale`, `roomBounds?`.
  - kind 'resize' → una etiqueta con `formatObjectSize` centrada sobre el AABB.
  - kind 'move' → hasta 4 etiquetas (left/right/top/bottom) con las distancias de `neighborGaps`,
    colocadas en el punto medio de cada hueco (línea de cota fina opcional, estilo CAD).
  - `listening={false}` (no interactivo), mismos estilos que draw-wall-overlay.

## Notas
- El overlay vive DENTRO de la capa de structure-layer (o la capa de overlays compartida) para no
  exceder el máximo de capas de Konva — ver nota en draw-wall-overlay/selection-overlay.
- `roomBounds`: si hay zona activa con bounds, pasarlos; si no, omitir (la fase 1 ya lo soporta).

## Validación
- `bunx tsc` + eslint limpios. Render manual: arrastrar → distancias; resize → tamaño.
