---
phase: 3
title: Medidas y snap al dibujar
status: completed
effort: ''
---

# Phase 3: Medidas y snap al dibujar

## Overview

Completa Draw Walls con precisión: snap a rejilla y a ángulos (0/45/90°), y **entrada de
medida exacta** (teclear la longitud del muro mientras se dibuja). Cierra el núcleo de F7.

## Decisión (medidas al dibujar)
- **Teclear longitud al trazar** (estilo Planner5D/CAD): mientras arrastras, un input flotante
  muestra la longitud editable; al teclear un número y Enter, el muro toma esa longitud exacta en
  la dirección actual del cursor. Es lo que pidió el usuario como ideal. Si resulta complejo en v1,
  fallback documentado: crear el muro y editar su "Largo" en el panel existente (toolbar ya lo permite).

## Architecture
- **Prioridad snap vs medida exacta (red-team #8):** la longitud TECLEADA tiene prioridad y NO se
  re-snapea a rejilla (si no, "2,35 m" → 2,4 m). El snap a rejilla aplica solo al arrastre libre sin
  valor tecleado. Definir explícitamente este orden.
- **Snap a rejilla**: reusar `snap()` de `src/components/canvas/layers/grid-layer.tsx:56` TAL CUAL
  (redondea a múltiplos de GRID=20px; NO crear un `snapPoint(p, grid)` parametrizado que nadie más usa
  — red-team #4). Importante: NO snapear el GROSOR del muro (0,15 m = 15 px se volvería 20 px); el grosor
  es fijo del catálogo, solo se snapean los endpoints del eje del muro cuando no hay medida tecleada.
- **Snap a ángulo**: forzar a 0/45/90/135° con el MISMO umbral que el Transformer existente
  (`structure-layer.tsx:182-183`, `rotationSnaps` con tolerancia 8°) para coherencia; lógica pura
  `snapAngle` en `draw-wall.ts`, testeable.
- **Input de longitud**: overlay HTML junto al cursor; teclear+Enter → punto fin = inicio + dirección·longitud.
  Cuidar el foco/teclado (que Enter no dispare atajos del editor); reusar patrón de `number-input.tsx`.

## Related Code Files
- Modify: `src/canvas/draw-wall.ts` (+ `snapAngle`, `snapPoint`, aplicar longitud tecleada).
- Modify: `src/canvas/use-draw-wall.ts` (estado del input de medida).
- Modify: `tests/canvas/draw-wall.test.ts` (+ snap de ángulo/rejilla, longitud exacta).
- Create: pequeño componente de input flotante (en components/canvas/) si hace falta.

## Implementation Steps
1. `snapPoint(p, grid)` y `snapAngle(p1, p2, stepDeg, thresholdDeg)` puros + tests.
2. Aplicar snap en el preview y al fijar el muro.
3. Input de longitud flotante: teclear valor → muro de longitud exacta. (Fallback: panel de Largo.)
4. Verificar: dibujar un muro de "4 m" exacto tecleando; snap a 90° al hacer una L.

## Success Criteria
- [ ] Snap a rejilla y ángulo funcionando (tests verdes).
- [ ] Se puede fijar la longitud exacta de un muro (teclear o, fallback, editar Largo).
- [ ] tsc + eslint + vitest verdes. **Núcleo F7 (fases 2–3) verificado en navegador antes de seguir.**

## Risk Assessment
- Input flotante + canvas: cuidar foco/teclado (que Enter no dispare atajos del editor). Reusar el
  patrón de `number-input.tsx` si encaja.
