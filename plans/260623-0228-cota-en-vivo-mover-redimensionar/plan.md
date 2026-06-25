---
title: Cota en vivo al mover y redimensionar objetos
description: ''
status: completed
priority: P1
branch: feat/canvas/cota-en-vivo
tags: []
blockedBy: []
blocks: []
created: '2026-06-23T00:28:00.000Z'
createdBy: 'manual'
source: roadmap-planner5d
---

# Cota en vivo al mover y redimensionar objetos

## Overview

Tier 1.3 del roadmap competitivo Planner5D
([referencia-planner5d-y-gaps.md](../260622-1142-referencia-planner5d/referencia-planner5d-y-gaps.md#L400)).
Planner5D muestra la medida REAL en tiempo real durante CUALQUIER manipulación, no solo al dibujar
muros. Hoy Habiteka ya muestra la cota en vivo al **dibujar** muros (`draw-wall-overlay.tsx`), pero
al **mover** o **redimensionar** un objeto no se ve nada hasta soltar. Objetivo: cota en vivo en
ambos gestos.

**Alcance (decisión del usuario + recorte del predict):** AMBAS medidas —
- **Al redimensionar:** el TAMAÑO del objeto en metros (ancho × fondo), reusando `formatObjectSize`.
- **Al mover:** las DISTANCIAS del objeto a sus VECINOS (otros objetos) más cercanos en X e Y (cotas
  de hueco, estilo CAD).

**Recortes del predict (CAUTION):**
1. **MVP = distancia a vecinos (objetos), NO a paredes.** La "distancia a la pared/roomBounds" se
   anota como mejora futura: requiere obtener los bounds de la zona activa, duplica la fase 1 y no es
   imprescindible para el valor central. Anotada en deuda futura.
2. **Distancias sobre AABB eje-alineado** (aproximación honesta): con objetos rotados a ángulos no
   múltiplos de 90° la proyección eje-alineada es aproximada, como en todo editor 2D. Documentado;
   NO se intenta distancia mínima entre polígonos rotados (scope creep).
3. **Precalcular los AABB de los vecinos en `onDragStart`** (no por frame): solo el AABB del objeto
   movido cambia durante el arrastre → se recalcula únicamente ese.

## Contexto (scout hecho — no re-investigar)

- **Patrón de cota ya existe** en `draw-wall-overlay.tsx`: `Label`+`Tag`+`Text` de react-konva +
  `pxToMeters`/`formatLength`/`isValidScale` de `scale.ts`. Replicar ese estilo visual.
- **`formatObjectSize(o, scale)`** (`scale.ts:55`) ya devuelve "ancho × fondo" en metros respetando
  rotación → reusar tal cual para la cota de tamaño (DRY).
- **`structure-layer.tsx`** dibuja cada objeto en un `<Group draggable>` y usa un `<Transformer>`.
  Hoy solo escribe al store en `onDragEnd` (:104) y `onTransformEnd` (:128). Faltan `onDragMove` y
  `onTransform` para el feedback EN VIVO. El gesto en curso NO debe tocar el store (no es un paso de
  undo): usar estado LOCAL transitorio que se limpia al soltar.
- **`selectionAabb`** (`src/canvas/floating-menu-anchor.ts`, creado en el plan anterior) ya calcula
  el AABB rotado de objetos → reutilizable para medir el objeto en movimiento contra los demás.
- **`scale.ts`** da toda la conversión px↔m. No hay helper de "distancia a vecinos"; se crea puro.
- El menú flotante (plan anterior) ya se OCULTA durante el drag (flag `dragging` en canvas-stage):
  la cota y el menú no compiten visualmente.

## Restricciones / invariantes

- **Lógica de medición PURA y testeable** (sin React/Konva): tamaño en m (reusa `formatObjectSize`)
  y distancias a vecinos. El componente solo renderiza.
- El gesto en curso usa estado LOCAL; el store solo se actualiza al soltar (como hoy). Sin nuevos
  pasos de undo por frame.
- Cota visible solo con escala usable (`isValidScale`); sin escala, mostrar px (como draw-wall) o
  nada — decidir en fase 1 (coherente con draw-wall: muestra px).
- Distancias: medir del AABB del objeto al AABB de los vecinos más cercanos en cada eje (izq/der,
  arriba/abajo). Si no hay vecino en un lado, medir a la pared/borde de la sala si es alcanzable; si
  no, omitir esa cota (no inventar).
- Reusar el estilo de cota de draw-wall (mismo `Tag`/`Text`), no introducir un look nuevo.
- Cero regresiones: drag/resize/multiselección actuales siguen igual; suite verde + tests nuevos.
- Sin `useEffect` directo (regla del proyecto): estado derivado / handlers de Konva.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Medición pura: tamaño + distancias a vecinos](./phase-01-medicion-pura.md) | Completed |
| 2 | [Overlay de cota en vivo en mover/redimensionar (UI)](./phase-02-overlay-cota-en-vivo.md) | Completed |
| 3 | [Verificación y cierre](./phase-03-verificacion-y-cierre.md) | Completed |

## Acceptance criteria (global)

- [x] Al REDIMENSIONAR un objeto, su tamaño en metros (ancho × fondo) se muestra en vivo (lógica
      `onTransform` + `formatObjectSize`; cubierto por tipos/patrón, pendiente captura manual del
      handle del Transformer — frágil de automatizar a ciegas).
- [x] Al MOVER un objeto, las distancias a los vecinos en X e Y se muestran en vivo (cotas de hueco)
      y se actualizan al arrastrar. **Verificado en navegador (captura): "60 cm/70 cm/20 cm" sobre
      la encimera arrastrada, con líneas de cota.** Funciona también sobre muros.
- [x] La cota desaparece al soltar; el store solo se actualiza al final (verificado en captura).
- [x] Sin escala usable: cota de tamaño no aplica; cotas de hueco solo con escala (decisión fase 1).
- [x] Lógica de medición cubierta por tests puros (8 tests); suite verde (498); tsc + eslint limpios.
- [x] Verificado en navegador real: mover muestra distancias a vecinos en vivo y desaparecen al
      soltar. (Resize: lógica lista; verificación visual del handle pendiente de prueba manual.)

## Dependencies

<!-- Reusa scale.ts, draw-wall-overlay (patrón) y floating-menu-anchor (selectionAabb). Sin deps nuevas. -->
