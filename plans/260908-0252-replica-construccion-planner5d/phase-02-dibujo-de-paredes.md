---
phase: 2
title: "Paredes encadenadas y topología"
status: pending
priority: P1
dependencies: [1]
---

# Paredes encadenadas

## Overview

Click inicial, previsualización, click siguiente y continuación desde extremo recién creado. Finalizar y cancelar explícitos, sin confundir el gesto con desplazamiento de cámara.
Evidencia: Dibujar Paredes oculta catálogo y muestra tutorial click izquierdo iniciar, mover para longitud, click confirmar; Esc/doble click finalizan. No se verificó una cadena realmente dibujada. Pared seleccionada verde, extremos cyan/magenta; panel Length 499,80 cm con tres radios de color y Thickness 10 cm. Semántica de los radios pendiente de confirmar.

## Requirements

- Snap a vértices, eje de pared y ortogonalidad; tolerancia en píxeles de pantalla convertida a mm según zoom.
- Prioridad determinista por distancia y tipo; no `.find()` que selecciona primer vértice dentro de radio.
- Cerrar contorno comparte ID de vértice; encuentro en T divide muro; cruces se nodifican atómicamente o rechazan con motivo visible.
- Cotas exteriores con flechas; longitud durante trazo; edición de longitud/grosor; Añadir esquina en punto elegido, no siempre 50%.
- Reubicar pared conserva uniones y actualiza habitaciones/huecos; no aparente unión dibujada con coordenadas distintas.

## Architecture

`wall-draw-machine.ts`: idle → placing → chaining → commit/cancel. Cada segmento confirmado es undo; cancelar solo elimina preview, no segmentos confirmados.
`snap-candidates.ts` puro con zoom, prioridades y guías. `add-wall-with-junctions` comando atómico devuelve mapa de IDs para aperturas y selección.
Separar longitud a ejes de longitud interior libre. Mostrar unidad y definición; no afirmar que cotas del modelo coinciden con cara interior sin cálculo del grosor.
Referencia observada muestra cara 5 m y exterior 5,2 m con grosor 10 cm. Usar fixture explícito para decidir qué dimensión edita cada control; 499,80 cm observado no debe convertirse en tolerancia arbitraria del motor.

## Related Code Files

- Modificar: `src/components/editor-v2/canvas-view.tsx`, `document-layer.tsx`.
- Modificar: `src/canvas/editor-v2/editing-operations.ts`, `dimension-layout.ts`, `wall-junctions.ts`.
- Modificar: `src/lib/editor-document/{topology,wall-commands,rooms}.ts`.
- Crear módulos de gesto/snap separados y pruebas `tests/canvas/editor-v2-wall-drawing.test.ts`.

## Implementation Steps

1. Caracterizar cadenas, Escape, doble click y pointercancel; fijar comportamiento según evidencia.
2. Comandos de subdivisión/remapeo antes de UI.
3. Preview y guías sin persistir cada pointermove; commit único.
4. Reusar cálculo de uniones y cotas; agregar controles contextuales.

## Success Criteria

- [ ] Rectángulo, L, T, cruz, diagonal y grosor desigual sin grietas ni vértices duplicados.
- [ ] Añadir esquina no mueve puertas; operación que corta un hueco se rechaza claramente.
- [ ] Arrastre y longitud no producen solapes de huecos ni paredes inválidas; undo restaura todo.
- [ ] Snap consistente al alejar/acercar y cierre exacto tras recargar.

## Risk Assessment

## Evidencia parcial — 2026-09-08

`wall-draw-machine` y `snap-candidates`: click encadenado, cierre con ID compartido, Escape/doble click, T atómica, rechazo de cruce interior y corte de vano, radio 12 px comprobado en tests. Cotas con flechas y campos longitud/grosor presentes. Pendiente: «Añadir esquina» en punto elegido (actual «Dividir al 50 %»), matriz completa en Comet con grosor desigual/diagonal, arrastre seguro y cierre exacto tras recarga. Cruce rechazado explícitamente es política permitida, no cruce nodificado implementado.

Nodificar puede invalidar ID anfitrión: tests de apertura sobre cada subsegmento, transacción indivisible. Curvas pendientes requieren geometría específica; no simular curva con decoración sobre eje recto.
<!-- Adenda 03:28: Añadir esquina por punto elegido ya implementado (tool split-wall,
preview y comando validado). 13 pruebas focalizadas junto con copia de escalera.
Comet confirma activación y Escape sin cambios; confirmar punto mediante ratón
y matriz completa de cierre/diagonales sigue pendiente. No cerrar criterio compuesto. -->
