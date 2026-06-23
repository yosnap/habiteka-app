# Fase 1 — Generación de contorno por forma (puro)

## Contexto
- `build-room-doc.ts`: `buildRoomDoc(RoomParams)` genera 4 muros de un rectángulo. PURO.
- `scale.ts`: `metersToPx`. `draw-wall.ts`: `DEFAULT_WALL_THICKNESS_M`.
- Muros = `StructObj { kind:'wall', x, y, width, height, rotation:0 }`.

## Requisitos
Generar el contorno de muros (axis-aligned, sin rotar) para las formas L, U y T, además del
rectángulo. Lógica pura testeable.

## Enfoque
Modelar cada forma como la UNIÓN de rectángulos axis-aligned y derivar los SEGMENTOS de muro del
perímetro del polígono resultante. Cada segmento del perímetro → un muro (caja fina de grosor `t`),
colocado hacia afuera del interior. Esquinas: solapar medio grosor para cerrar sin huecos.

## Archivos a crear/modificar
- **Crear** `src/canvas/wizard/room-shapes.ts`:
  - `type RoomShape = 'rect' | 'l' | 'u' | 't'`.
  - Parámetros por forma (tipos): rect {widthM, lengthM}; L/U/T añaden las medidas del recorte
    (p. ej. L: ancho total, largo total, ancho del brazo / profundidad del recorte).
  - `roomOutline(shape, params): {x,y}[]` — vértices del polígono interior en px (cerrado, CCW).
  - `outlineToWalls(vertices, thicknessPx): StructObj[]` — un muro por arista del perímetro, hacia
    afuera, esquinas cerradas. Reutilizable para todas las formas (rect incluido).
- **Modificar** `build-room-doc.ts`:
  - `buildRoomDoc` pasa a aceptar `shape` + params de forma y delega en `roomOutline` +
    `outlineToWalls`. El caso `rect` debe producir EXACTAMENTE los mismos 4 muros que hoy (verificar
    con test de regresión: mismas coords).

## Tests
- `tests/canvas/wizard/room-shapes.test.ts`:
  - `rect` produce 4 muros idénticos a los actuales (regresión).
  - L/U/T: nº de muros esperado, contorno cerrado (cada vértice tocado), interior correcto.
  - Sin huecos en esquinas (los muros adyacentes se tocan/solapan).

## Validación
- `bunx vitest run tests/canvas/wizard/room-shapes.test.ts` verde; `bunx tsc` limpio.
