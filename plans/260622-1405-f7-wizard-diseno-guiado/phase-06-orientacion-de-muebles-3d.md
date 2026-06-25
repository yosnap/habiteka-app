---
phase: 6
title: Orientacion de muebles 3D
status: completed
effort: ''
---

# Phase 6: Orientacion de muebles 3D

## Overview

Resuelve la observación del usuario: en 3D los muebles deben tener su "frente" correcto (sofá
de espaldas a la pared, no mirándola). Hoy `docToScene` solo aplica la rotación del 2D. Esta fase
añade el concepto de FRENTE por kind y, opcionalmente, anclaje a la pared más cercana.

## Aclaración (red-team #6): dos cosas DISTINTAS, no mezclar
1. **Calibración del glTF** (`frontOffsetRad` por modelo): corrige que un glTF venga girado respecto a
   su `rotationY`. Es un OFFSET CONSTANTE por modelo → gira todos los sofás igual; NO resuelve por sí
   solo "el sofá mira a la pared".
2. **Orientación semántica** ("mirar al interior"): eso DEBE venir de la `rotation` correcta en el doc,
   que la pone autofurnish (fase 5) por pared, o el usuario al rotar. El offset por modelo NO la sustituye.
El acceptance "muebles orientados con sentido" se cumple por la combinación: autofurnish pone la rotation
correcta + el offset del modelo lo deja mirando como su rotation indica.

## Architecture
- **Frente por kind** (declarativo en el mapa de modelos): `frontOffsetRad` por entrada — calibración del
  glTF, determinista, dato (no algoritmo). Se SUMA a `item.rotationY` en `FurnitureModel`.
- **Dos niveles** (elegir el más simple que resuelva):
  1. **Respetar rotation del 2D + corregir el frente del modelo** (offset por kind en el mapa
     kind→glTF). Barato; resuelve "el sofá mira al revés" cuando el modelo viene girado.
  2. **Auto-anclaje** (opcional): si el mueble está pegado a una pared, orientarlo hacia el interior.
     Heurística pura: detectar pared más cercana y girar. Más complejo; valorar si hace falta tras (1).
- Implementación en `furniture-models.ts` (offset de orientación por modelo) y/o `doc-to-scene.ts`
  (heurística de anclaje, pura y testeable). El usuario YA puede rotar en 2D; esto corrige el modelo.

## Related Code Files
- Modify: `src/canvas/3d/furniture-models.ts` (+ `frontOffsetRad` por entrada del mapa).
- Modify: `src/components/canvas/3d/furniture-layer.tsx` (aplicar el offset de frente del modelo).
- Posible modify: `src/canvas/3d/doc-to-scene.ts` (heurística de anclaje a pared, si se incluye).
- Posible test: `tests/canvas/3d/orientation.test.ts`.

## Implementation Steps
1. Añadir `frontOffsetRad` al mapa de modelos; aplicarlo en `FurnitureModel` junto a `rotationY`.
2. Calibrar el offset de cada modelo real (silla/sofa) mirando el render.
3. (Opcional) Heurística de anclaje a pared para auto-orientar; tests puros.
4. Verificar en 3D: el sofá del salón mira al interior, no a la pared.

## Estado (jun-2026)
Infraestructura ENTREGADA: `frontOffsetRad` por modelo en `furniture-models.ts` (+ helper
`furnitureFrontOffset`) y aplicado en `FurnitureModel` (se suma a `rotationY`). Valor 0 por ahora.
**Decisión del usuario:** la CALIBRACIÓN fina del ángulo de cada modelo se hace en F7.7, junto con
la cura/reemplazo de modelos (lámpara≠farola, Kenney) — calibrar los modelos definitivos, no los
provisionales (sería trabajo desechable). El auto-anclaje a pared queda como mejora futura.

## Success Criteria
- [x] Mecanismo de orientación por modelo (`frontOffsetRad`) implementado y aplicado.
- [x] tsc + eslint verdes.
- [x] Calibración de ángulos por modelo → diferida a F7.7 (con los modelos definitivos).

## Risk Assessment
- El "frente" depende de cómo venga cada glTF; es calibración por modelo (dato), no algoritmo. Mantenerlo
  declarativo. El auto-anclaje puede dar sorpresas con muebles centrales (no anclados) → aplicarlo solo
  cuando el mueble esté claramente junto a una pared.
