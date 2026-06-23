# Fase 2 — Wizard: selector de forma + parámetros + preview

## Contexto
- `design-wizard.tsx`: paso 'room' con 2 sliders (ancho/largo) + `RoomPreview` (rect SVG) + paso
  'furniture'. `buildRoomDoc(params)` al confirmar.
- Fase 1: `RoomShape` + `roomOutline` + `buildRoomDoc(shape, params)`.

## Requisitos
Permitir elegir la forma y sus medidas antes de generar la sala, con preview en vivo.

## Archivos a modificar/crear
- **Modificar** `design-wizard.tsx`:
  - Añadir selector de FORMA (rectángulo/L/U/T) al inicio del paso 'room' (botones con icono/mini
    preview de cada forma).
  - Parámetros según forma: rect = ancho/largo (como hoy); L/U/T = los sliders extra que defina la
    fase 1. Estado local por parámetro; sin `useEffect` directo (derivar el preview del estado).
  - `onCreate(buildRoomDoc(shape, params), ...)`.
- **Generalizar `RoomPreview`** (o crear `ShapePreview`): dibujar el polígono de `roomOutline` en
  SVG (no solo el rect). Así el preview refleja cualquier forma con una sola implementación.

## Notas
- Mantener el flujo actual: tras 'room' → paso 'furniture'. La forma elegida viaja para que la fase 3
  decida el auto-amueblado.
- Validación de medidas por forma (`isValidRoom` equivalente por forma): evitar recortes imposibles
  (p. ej. brazo de la L más ancho que el total).

## Validación
- `bunx tsc` + eslint limpios. Preview manual: cambiar forma/medidas actualiza el dibujo.
