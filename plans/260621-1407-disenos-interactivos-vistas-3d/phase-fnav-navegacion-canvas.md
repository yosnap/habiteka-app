# F-NAV · Herramientas de navegación del canvas (seleccionar / mover / zoom)

**Estado: ✅ COMPLETADA.** Rama: `feat/canvas/decoracion-materiales-luces`. Verificado en navegador
(3 modos exclusivos, ajustar a pantalla, controles +/−/100%). Mejora de UX del editor.

## Pendiente (futuro, anotado con el usuario)
- **Atajos de teclado para los modos:** tecla rápida para Seleccionar (V), Mover (H/espacio ya
  existe como temporal) y Zoom (Z), al estilo de Figma/Canva. Hoy los modos se cambian por botón;
  los atajos se añadirán en una mejora futura.

## Objetivo

Dar las herramientas de navegación que tiene cualquier editor tipo Canva/Figma, con modos que no
choquen entre sí: **Seleccionar**, **Mover** (pan: desplazar la vista, no los objetos), **Zoom**,
más **Ajustar a pantalla** y controles **+/−** visibles.

## Estado verificado (scout)

Ya existe en `canvas-stage.tsx`:
- Zoom con rueda y Ctrl/Cmd +/−/0 (`zoomTo`, `onWheel`, `view = {scale,x,y}`).
- Pan SOLO con barra espaciadora (`spaceDown`) — poco descubrible.
Falta: modos explícitos en la toolbar, botón de ajustar-a-pantalla, y controles +/− en pantalla.

## Decisiones tomadas con el usuario

- Set completo: **modos Seleccionar / Mover / Zoom** + **Ajustar a pantalla** + **+/− visibles**.
- El modo **Mover** hace pan al arrastrar (no selecciona ni mueve objetos); el modo **Seleccionar**
  selecciona/edita; el modo **Zoom** acerca al clicar (o usa +/−). No deben interferir entre sí.

## Diseño

- Ampliar el tipo `Tool` (en `canvas-toolbar.tsx`) con `'pan'` y `'zoom'` (ya hay 'select',
  'freehand', kinds). Botones de modo en la toolbar.
- En `canvas-stage.tsx`:
  - Modo `pan`: el Stage es `draggable` y el arrastre desplaza la vista (`view.x/y`); el cursor es
    "grab". No crea ni selecciona objetos.
  - Modo `zoom`: clic = zoom-in al punto (Shift+clic o botón − = zoom-out); o se delega a +/−.
  - Mantener el pan con barra espaciadora como atajo (no romperlo).
  - `fitToContent()`: calcula el bounding box de los objetos y ajusta `view` (scale + x/y) para
    encuadrarlos con margen. `resetView()` vuelve a 100%.
- Controles flotantes +/− y "ajustar" sobre el canvas (esquina), o en la toolbar.

## Archivos a modificar

- `src/components/canvas/canvas-toolbar.tsx` — añadir modos Mover/Zoom + botones Ajustar/+/−.
- `src/components/canvas/canvas-stage.tsx` — comportamiento de pan/zoom por modo; `fitToContent`,
  `resetView`; exponer zoom in/out para los botones (subir handlers o estado al workspace, o
  controles dentro del stage).
- Posible pieza nueva `canvas-view-controls.tsx` si los controles +/−/fit se separan (modularidad).

## TDD / Validación

- Lógica PURA testeable: `fitToContent` (bbox de objetos → scale/x/y que encuadra) como función
  pura en `src/canvas/` con test. El resto (interacción Konva) se valida manualmente / en navegador.
- Verificación: typecheck, eslint, tests focales; comprobación en navegador (yo) de los 3 modos.

## Riesgos y rollback

- Riesgo bajo-medio: toca la interacción del stage (no el modelo). Rollback = quitar los modos.
- Cuidar que cambiar de modo no pierda la selección ni rompa los atajos de teclado existentes.

## Checklist de entrega

- [x] Modos Seleccionar / Mover / Zoom en la toolbar (exclusivos, verificado en navegador).
- [x] Pan por arrastre en modo Mover; zoom por clic (Shift=alejar) en modo Zoom.
- [x] `fitToContent` (ajustar a pantalla) + `resetView` (100%) + 5 tests puros de fitToContent.
- [x] Controles +/− y "Ajustar"/"100%" visibles (overlay sobre el canvas).
- [x] Verificación: typecheck, eslint, tests; prueba en navegador.
- [ ] (Futuro) Atajos de teclado para los modos (V/H/Z).
