---
phase: 5
title: Auto-amueblado procedural
status: completed
effort: ''
---

# Phase 5: Auto-amueblado procedural

## Overview

Coloca un set de muebles coherente según el tipo de sala, **por reglas (sin IA)**: salón =
sofá + mesa de centro + TV (enfrentados), dormitorio = cama + mesillas + armario, etc. Determinista
e instantáneo. Es el paso "amueblar" del wizard, pero también invocable desde el editor.

## Precondición (red-team #6): SOLO salas rectangulares del wizard
`autofurnish` opera por fracción de ancho/largo y paredes cardinales (N/S/E/O), lo que SOLO vale para un
rectángulo axis-aligned. Draw Walls (fase 2) permite formas arbitrarias/rotadas. **En v1, autofurnish se
invoca SOLO desde el wizard (sala rectangular conocida), NO sobre salas dibujadas a mano.** Si se invoca
sobre una sala no rectangular, avisar/rechazar en vez de colocar muebles fuera de las paredes.

## Architecture
- **Plantillas declarativas** por tipo de sala: lista de {kind, posición relativa (fracción del
  ancho/largo), pared de anclaje, orientación}. P. ej. salón: sofá contra pared sur mirando al norte,
  TV contra pared norte, mesa al centro.
- **Colocador puro** `autofurnish(roomDoc, roomType)` → devuelve los `StructObj` de muebles colocados
  en coordenadas absolutas (px) a partir de las dimensiones de la sala y la escala. Reusa `catalog.ts`
  (medidas reales) y `scale.ts`. Sin solapamientos groseros (reglas simples de separación).
- **Cota de objetos (red-team #13):** límite duro de muebles por sala (acotar por área×densidad y un máx),
  para no generar docs enormes (serialize.ts no topa nº de objetos; un doc gigante cuelga R3F y satura JSONB).
- La orientación que asigna aquí (rotation/flip) alimenta la fase 6 (orientación 3D), de modo que el
  mueble ya nace "mirando" bien.

## Related Code Files
- Create: `src/canvas/wizard/furnish-templates.ts` (plantillas por tipo de sala, declarativas).
- Create: `src/canvas/wizard/autofurnish.ts` (puro: sala + tipo → StructObj[] de muebles).
- Create: `tests/canvas/wizard/autofurnish.test.ts`.
- Modify: `design-wizard.tsx` (paso "amueblar" usa autofurnish; opción de saltar).
- Reference: `src/canvas/catalog.ts`, `src/canvas/scale.ts`.

## Implementation Steps
1. `furnish-templates.ts`: definir 3-4 tipos (salón, dormitorio, cocina, baño) con sus sets y anclajes.
2. `autofurnish.ts`: resolver posiciones absolutas dentro de la sala; respetar medidas reales; tests
   (los muebles caen dentro del recinto, contra la pared correcta, sin salirse).
3. Integrar en el wizard como paso opcional; permitir reordenar después en el editor.
4. Verificar: wizard salón → set colocado con sentido (sofá enfrenta TV) en 2D y 3D.

## Mejoras futuras (post-F7, pedidas por el usuario jun-2026)
- **Más tipos de sala / espacios combinados**: p. ej. "cocina americana" (cocina + salón en un
  mismo espacio abierto), estudio, comedor, etc. Requiere plantillas combinadas y, posiblemente,
  dividir el recinto en zonas funcionales. No bloquea F7; ampliar `room-types` + `furnish-templates`.

## Success Criteria
- [x] `autofurnish` puro y testeado (muebles dentro de la sala, anclados, sin solapes groseros).
- [x] Set coherente por tipo de sala, determinista.
- [x] tsc + eslint + vitest verdes.

## Risk Assessment
- Evitar sobre-ingeniería (YAGNI): reglas simples por plantilla, no un solver de layout. Variedad
  mínima; el usuario reordena a mano.
