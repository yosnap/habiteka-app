---
phase: 1
title: Modelo de seleccion y layout sin solapes (puro)
status: completed
effort: ''
---

# Phase 1: Modelo de seleccion y layout sin solapes (puro)

## Overview
Núcleo, todo lógica pura. (a) Un catálogo declarativo de "qué muebles ofrece cada tipo de sala"
con defaults, repetibles y opcionales. (b) Reescribir el reparto de muebles por pared para que NO
se solapen, respetando el ancho real de cada mueble. `autofurnish` pasa a recibir la SELECCIÓN del
usuario (qué kinds y cuántos) en vez de un set fijo.

## Requirements
- Funcional: por tipo de sala, lista de muebles con `{ kind, default: boolean, repeatable?, optional? }`.
- Funcional: `autofurnish(doc, roomType, selection)` coloca solo lo seleccionado, repartido por pared
  sin solapes; si una pared no tiene sitio para todo, omite los que no caben (no solapa).
- Funcional: compatibilidad — sin `selection`, usa los defaults del tipo (no rompe llamadas actuales).
- No-funcional: puro, determinista, testeable.

## Architecture

> Correcciones del red-team incorporadas: el solape real está en las ESQUINAS entre paredes
> perpendiculares (C1) y en el FONDO de los muebles vs piezas centrales (C2); el modelo necesita el
> anchor por kind (A1) y orden intra-fila (A2). El criterio de test pasa de "misma pared" a "global".

**Catálogo de opciones** `src/canvas/wizard/room-furniture-options.ts` (puro):
- `RoomFurnitureOption { kind; label; anchor: WallAnchor; default: boolean; repeatable?: boolean;
  maxQty?: number; defaultQty?: number; order?: number }`. **El anchor vive AQUÍ** (A1), no en la
  selección; `order` ordena dentro de la fila (A2: cama order 1 centrada, mesillas a los lados).
- `ROOM_FURNITURE: Record<RoomType, RoomFurnitureOption[]>` con anchor para TODOS los kinds:
  - Cocina: fregadero(N,def), encimera(N,def), horno(N,def), nevera(O,def), isla(center,opt).
  - Salón: sofá(S,def), tv(N,def), mesa(center,def), silla(center,rep def 2), lampara(E,opt),
    alfombra(center,opt), planta(O,opt), chimenea(N,opt).
  - Dormitorio: cama(N,def,center-de-pared), mesilla(N,rep def 2, a los lados), armario(S,def),
    lampara(E,opt).
  - Baño: inodoro(O,def), lavabo(N,def), ducha(E,def), banera(S,opt), bidet(O,opt).
- `FurnitureSelection = Record<string, number>` (kind → cantidad; 0/ausente = no colocar).
- `defaultSelection(roomType)` → selección desde `default`/`defaultQty`.

**Layout sin solapes** — reescribir `autofurnish` (y reemplazar/derivar `furnish-templates`):
1. **Recinto reducido por esquinas (C1):** antes de repartir, calcular el fondo máximo de los muebles
   asignados a cada pared. La longitud útil de la fila N/S se acorta restando el fondo de las filas
   E/O (y viceversa): fila N empieza en `inner.x + maxDepth(O)` y acaba en
   `inner.x + inner.width − maxDepth(E)`. Así las filas perpendiculares no invaden la misma esquina.
2. **Fila por pared respetando ANCHO (a lo largo) y FONDO (hacia el interior):** por pared, expandir
   repetibles a N ítems, ordenar por `order`, acumular anchos reales (px) + gap, y colocar en fila
   centrada en la longitud útil. El mueble se pega a la pared a su fondo real (ya lo hace `placeOne`).
3. **Piezas `center` (mesa, isla, silla, alfombra) en recinto interior REDUCIDO (C2):** el centro se
   calcula sobre el rectángulo interior menos el fondo de las 4 filas perimetrales, para no chocar con
   encimera/sofá/etc. Si una pieza center no cabe en el reducido, se omite (→ overflow).
4. **Overflow = avisar, nunca solapar (decisión usuario):** si un mueble seleccionado no cabe, NO se
   coloca y se acumula en una lista `omitted: StructKind[]`. `autofurnish` devuelve
   `{ objects: StructObj[]; omitted: StructKind[] }` (cambia el tipo de retorno) para que la UI avise.
   Prioridad: defaults antes que opcionales al competir por sitio.
5. **Orden intra-fila (A2):** en dormitorio, cama centrada en su fila y mesillas inmediatamente a los
   lados (por `order`); el reparto centrado por `order` lo consigue sin lógica especial.
- Mantener `interiorRect` y la precondición rectangular. Ids de muebles únicos y deterministas por
  índice GLOBAL (no por pared) para no repetir (memoria: ids únicos).

**Firma nueva:** `autofurnish(doc, roomType, selection?: FurnitureSelection): { objects: StructObj[];
omitted: StructKind[] }`. Sin `selection`, usa `defaultSelection(roomType)`. **Cambia el tipo de
retorno** (antes `StructObj[]`): actualizar el caller `canvas-workspace.tsx:349` y el test.

## Related Code Files
- Create: `src/canvas/wizard/room-furniture-options.ts`
- Create: `tests/canvas/wizard/room-furniture-options.test.ts`
- Modify: `src/canvas/wizard/furnish-templates.ts` (asignación pared↔kind + datos de reparto; quitar
  `along` fijo o reinterpretarlo como orden) o sustituir por la nueva lógica de fila.
- Modify: `src/canvas/wizard/autofurnish.ts` (recibe `selection`; reparto por pared sin solapes).
- Modify: `tests/canvas/wizard/autofurnish.test.ts` (nuevos asserts: sin solapes, respeta selección).

## Implementation Steps
1. Crear `room-furniture-options.ts` con `ROOM_FURNITURE` (anchor+order por kind), `FurnitureSelection`,
   `defaultSelection`.
2. Reescribir `autofurnish`: recinto reducido por esquinas, expandir repetibles, repartir en fila por
   ancho real (centrada, por `order`), piezas center en recinto interior reducido, acumular `omitted`.
   Devolver `{ objects, omitted }`.
3. Actualizar caller `canvas-workspace.tsx:349` al nuevo retorno (usar `.objects`; `omitted` → fase 2).
4. Tests con helper de intersección AABB **global** (todos los pares, no solo misma pared):
   - cocina 3×3 con defaults: 0 solapes (incluida esquina nevera-O ↔ encimera-N).
   - cocina con isla: isla center no choca con encimera (fondo respetado).
   - salón con N sillas: cantidad correcta, sin solapes.
   - dormitorio: cama centrada + 2 mesillas a los lados, sin solapes.
   - sala pequeña: muebles que no caben van a `omitted`, los colocados no se solapan.
   - sin `selection`: usa `defaultSelection`.
5. Actualizar `autofurnish.test.ts` (el salón ahora incluye sillas por defecto — aserción cambia).
6. tsc + eslint + `bunx vitest run tests/canvas/wizard`.

## Success Criteria
- [ ] `ROOM_FURNITURE` (con anchor) + `defaultSelection` testeados.
- [ ] `autofurnish` reparte SIN solapes GLOBALES (test AABB de todos los pares), incluidas esquinas y
      piezas center vs fondo de las filas.
- [ ] Devuelve `{ objects, omitted }`; lo que no cabe va a `omitted`, nunca se solapa.
- [ ] Repetibles expanden a N; opcionales aparecen al seleccionarse; orden cama+mesillas correcto.
- [ ] Caller actualizado; tests de `tests/canvas/wizard` verdes; tsc + eslint limpios.

## Risk Assessment
- **Solape en esquinas (C1):** recinto reducido restando el fondo de las paredes perpendiculares.
  Test obligatorio con la esquina nevera-O ↔ encimera-N.
- **Fondo vs center (C2):** piezas center en recinto interior reducido por el fondo de las 4 filas.
- **Anchor por kind (A1):** vive en `ROOM_FURNITURE`, definido para TODOS los kinds (incl. opcionales).
- **Overflow (decisión usuario):** avisar vía `omitted`, nunca solapar; defaults antes que opcionales.
- **Cambio de retorno (M1):** `{objects,omitted}` rompe el caller y un test; actualizar ambos en el
  mismo commit. Ids de muebles únicos por índice global.
