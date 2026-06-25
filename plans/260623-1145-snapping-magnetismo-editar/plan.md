---
title: Snapping / magnetismo al editar objetos del plano
description: ''
status: pending
priority: P1
branch: feat/canvas/snapping-editar
tags: []
source: feedback-usuario
created: '2026-06-23T11:45:00.000Z'
---

# Snapping / magnetismo al mover y redimensionar objetos

## Problema (feedback del usuario)

Al mover un muro o un mueble (p. ej. una cama) en el plano **no hay ajuste fino**: el
objeto no se "engancha" a las paredes ni se alinea automáticamente con otros muebles.
Hoy solo hay snap a **rejilla de 20 px** y **solo al soltar** (`onDragEnd`/`onTransformEnd`).
Durante el arrastre no hay enganche; la cota en vivo solo MIDE distancias, no AJUSTA.

## Estado actual (scout hecho — no re-investigar)

- **`structure-layer.tsx`** (`src/components/canvas/layers/`): Group `draggable` por objeto.
  - `onDragStart:103` precalcula AABB de vecinos no seleccionados (`neighborsRef`).
  - `onDragMove:112` calcula AABB actual y actualiza la cota en vivo (no ajusta posición).
  - `onDragEnd:121` aplica `snap()` (rejilla 20 px) a x/y; mueve multiselección por delta.
  - `onTransform:146` / `onTransformEnd:166` cota de tamaño + snap de rejilla al soltar.
  - Transformer con `rotationSnaps` cada 45° (eso ya funciona).
- **`live-dimensions.ts`**: `neighborGaps(moving, others, scale)` mide huecos AABB a los
  4 lados (puro, testeado). Comentario explícito: distancia a paredes = futuro.
- **`floating-menu-anchor.ts`**: `selectionAabb(objects, ids)` y `rotatedCorners(o)`
  (AABB respetando rotación, puros). `WorldRect = {x,y,width,height}`.
- **`grid-layer.ts`**: `snap(v)=round(v/20)*20`, `GRID=20`.
- **`canvas-store.ts`**: `updateObject(id, patch)` (immutable).
- Mecanismo idóneo para snap EN VIVO durante el arrastre: **`dragBoundFunc`** del Group
  (Konva): recibe la posición propuesta y devuelve la corregida (enganchada) cada frame.

## Alcance (decidido por el usuario — las 4 piezas)

1. **Enganche a paredes**: arrastrar un mueble cerca de una pared lo pega a ella.
2. **Alinear con otros muebles**: guías de alineación + enganche a bordes/centros de
   muebles cercanos.
3. **Snap EN VIVO durante el arrastre**: enganchar mientras se arrastra (con guías
   visibles), no solo al soltar.
4. **Mover muros con precisión**: arrastrar un muro manteniendo el contorno coherente.

## Estrategia técnica

- **Lógica de snap PURA y testeable** en `src/canvas/` (sin React/Konva): dado el AABB
  del objeto en movimiento, los AABB de candidatos (paredes + muebles) y un umbral en px,
  devolver el desplazamiento (dx,dy) que engancha + las líneas-guía a dibujar. Reusa
  `WorldRect`, `selectionAabb`, `rangesOverlap`.
- **Aplicación**: `dragBoundFunc` en el Group para corregir la posición en vivo; las guías
  y la cota se pintan en el overlay existente.
- **Umbral de snap**: **8 px** (decidido por el usuario), configurable. Rejilla como fallback.
- **Desactivar snap con tecla** (decidido): mantener **Alt** (o Cmd) mientras se arrastra
  desactiva el enganche para colocación libre. El `dragBoundFunc` lee el modificador.
- **Orden de trabajo** (decidido): **predict de la Fase 4 (mover muros) PRIMERO**, antes de
  implementar nada, por ser lo más arriesgado. Luego Fases 1→2→3 y, según el predict, Fase 4.
- **Riesgo (predict recomendado)**: mover muros sin romper el contorno es lo más delicado
  (las esquinas comparten geometría). Se separa en su propia fase y puede acotarse.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Núcleo de snap puro: candidatos + enganche + guías](./phase-01-nucleo-snap-puro.md) | Pending |
| 2 | [Aplicar snap en vivo al mover muebles (dragBoundFunc + guías)](./phase-02-snap-vivo-muebles.md) | Pending |
| 3 | [Enganche a paredes de la sala](./phase-03-enganche-paredes.md) | Pending |
| 4 | [Mover muros con precisión (contorno coherente)](./phase-04-mover-muros.md) | Pending |

## Acceptance criteria (global)

- [ ] Al arrastrar un mueble cerca del borde de una pared, se pega a ella (umbral visible).
- [ ] Al arrastrar un mueble cerca de otro, sus bordes/centros se alinean con guía visible.
- [ ] El enganche ocurre EN VIVO durante el arrastre, no solo al soltar.
- [ ] Mover un muro mantiene el contorno de la sala coherente (sin huecos nuevos).
- [ ] Lógica de snap cubierta por tests puros; suite verde; tsc+eslint+build limpios.
- [ ] Verificado en navegador: mover cama hacia pared → se engancha; alinear dos muebles.

## Dependencies

<!-- Reusa neighborGaps/live-dimensions, selectionAabb/rotatedCorners, snap() de grid.
     Sin deps nuevas. Konva dragBoundFunc ya disponible. -->

## Notas

- Trabajo NUEVO, separado del PR de formas de sala (commit 1dd3452 en
  feat/canvas/formas-sala). Rama propia `feat/canvas/snapping-editar`.
- Se recomienda PREDICT antes de la Fase 4 (mover muros) por su delicadeza.
