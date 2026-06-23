# Fase 1 — Acción de store setFloorOutline + regenerar muros

## Contexto
- `canvas-store.ts`: `mutate()` (historial 50), `updateObjects`. Falta `setFloorOutline`.
- `outlineToWalls(vertices, t)` (room-shapes.ts) regenera los muros de un contorno (ortogonal,
  ya cierra esquinas convexas/cóncavas). `doc.floorOutline` ya se persiste y alimenta el 3D.

## Requisitos
Acción que, dado un nuevo contorno de vértices, actualice `doc.floorOutline` y REGENERE los
muros del contorno (reemplazando los `kind:'wall'` previos), todo en una mutación con historial.

## Enfoque
- `setFloorOutline(vertices: FloorVertex[]): void` en el store:
  - Calcula el grosor `t` desde la escala del doc (mismo criterio que build-room-doc).
  - `nuevosMuros = outlineToWalls(vertices, t)`.
  - Reemplaza en `doc.objects` SOLO los muros del contorno por los nuevos; conserva muebles,
    ventanas/puertas, luces. (Decisión: identificar los muros del contorno; lo más simple y
    robusto es regenerar todos los `kind:'wall'` que pertenecían al contorno. Si hay muros
    dibujados a mano sueltos, ver nota.)
  - Actualiza `doc.floorOutline = vertices`.
  - Pasa por `mutate()` (entra en historial).
- **Nota muros a mano**: en este PR el editor de contorno opera sobre salas con `floorOutline`
  (wizard). Los muros del contorno son los regenerables; si coexisten muros sueltos a mano, se
  conservan (no se tocan). Documentar el límite.

## Tests
- `tests/canvas/canvas-store.test.ts` (o nuevo): setFloorOutline regenera el nº de muros del
  nuevo contorno, actualiza floorOutline, conserva muebles, y es deshacible (undo restaura).

## Validación
- `bunx vitest run` del store verde; `bunx tsc` limpio.
