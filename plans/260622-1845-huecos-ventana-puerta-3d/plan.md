---
title: Huecos reales de ventana y puerta en muros 3D
description: ''
status: completed
priority: P2
branch: fix/canvas/3d-suelo-y-cierre
tags: []
blockedBy: []
blocks: []
created: '2026-06-22T16:43:08.283Z'
createdBy: 'ck:plan'
source: skill
---

# Huecos reales de ventana y puerta en muros 3D

## Overview

Hoy ventana y puerta se renderizan en 3D como cajas grises macizas idénticas a un muro
(`doc-to-scene.ts` las trata como `STRUCTURAL_KINDS` y emite un `WallBox` de altura completa),
así que se funden con la pared y "no se ven". Objetivo: **hueco real** — la ventana abre un
vano con cristal translúcido a media altura, la puerta abre un vano desde el suelo, recortando
la geometría del muro donde están.

**Enfoque (sin CSG):** descomponer cada muro en cajas alrededor del hueco (izquierda + derecha +
dintel, y para ventana también alféizar), en lógica pura dentro de `src/canvas/3d`. El render
sigue recibiendo `WallBox[]` (un hueco = ausencia de caja en ese tramo), más un nuevo
`GlassPane[]` para los cristales. Sin librerías de boolean ni riesgo de rendimiento.

**Decisiones fijadas (no hay datos en el modelo):**
- Alféizar de ventana: `0,9 m` desde el suelo. Dintel: `0,3 m` bajo el techo.
- Puerta: desde el suelo (`v0=0`) hasta `0,3 m` bajo el techo (o su `heightM` si lo trae).
- Asociación hueco↔muro: por **distancia perpendicular del centro del hueco al eje del muro** (no
  por área de solape: los solapes reales del seed son de solo 6–9px). Con datos válidos siempre
  asocia; si no (inalcanzable), se omite el hueco con aviso — NO se dibuja caja maciza (que
  reintroduciría "no se ve el hueco").
- Eje longitudinal del muro = su **lado mayor** (`L=max(w,h)`), NO derivado de `rotation`: los muros
  del seed (`w-left`: w=15,h=360,rot=0) tienen el lado largo en `height`, mientras Draw Walls lo
  pone en `width`. Sin esto, el caso de uso principal (puerta del salón/baño) fallaría.

## Restricciones / invariantes
- Lógica pura en `src/canvas/3d/*` (sin React/Three); el componente solo dibuja.
- El recorte de muros por cámara (`Walls` en `plan-3d-view.tsx`) usa `walls[i] ↔ refs.current[i]`:
  al haber más segmentos, cada uno es un `WallBox` normal y el mapeo por índice se mantiene.
- El suelo usa bbox de SOLO kind `wall` (ya correcto) — la descomposición NO debe cambiarlo.
- Cero regresiones: los 453 tests verdes deben seguir verdes; añadir tests del troceado.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Descomposicion de muros (puro)](./phase-01-descomposicion-de-muros-puro.md) | Completed |
| 2 | [Cristal y vano (render)](./phase-02-cristal-y-vano-render.md) | Completed |
| 3 | [Verificacion y cierre](./phase-03-verificacion-y-cierre.md) | Completed |

## Acceptance criteria (global)
- [ ] En 3D, la ventana es un vano con cristal translúcido a media altura; la puerta un vano
      desde el suelo; ambos claramente distinguibles del muro.
- [ ] El muro queda recortado alrededor del hueco (no caja maciza encima).
- [ ] El recorte por cámara sigue ocultando el muro frontal (incluidos los nuevos segmentos).
- [ ] Suelo intacto (tamaño/centro correctos); 453+ tests verdes; tsc + eslint limpios; build OK.
- [ ] Verificado en navegador real (dev-login → proyecto → Ver en 3D) en salón y baño de ejemplo.

## Dependencies
Ninguna cruzada. Parte de la rama `fix/canvas/3d-suelo-y-cierre` (sobre `develop`), que ya
incluye el fix del suelo (bbox con rotación) del que depende la geometría de muros.
