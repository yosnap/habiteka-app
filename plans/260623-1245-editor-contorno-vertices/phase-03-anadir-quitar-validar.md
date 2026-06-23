# Fase 3 — Añadir / quitar vértices + validación de polígono

## Contexto
- Fases 1-2: `setFloorOutline` + capa de handles con arrastre ortogonal.
- Contorno = polígono cerrado ortogonal de `floorOutline`.

## Requisitos
Doble-clic en una arista añade un vértice (parte la arista en dos); doble-clic en un vértice
lo quita; solo si el polígono resultante sigue siendo VÁLIDO (cerrado, sin auto-intersección,
área positiva, mínimo 4 vértices ortogonales).

## Enfoque
- Lógica PURA en `outline-edit.ts`:
  - `insertVertexOnEdge(outline, edgeIndex, point): Pt[]` — inserta un vértice en la arista
    (proyectado, manteniendo ortogonalidad: el nuevo punto crea un pequeño escalón recto).
  - `removeVertex(outline, i): Pt[] | null` — quita el vértice y recompone las aristas vecinas;
    null si el resultado no es ortogonal/válido.
  - `isValidOutline(outline): boolean` — cerrado, ≥4 vértices, sin auto-intersección, área > 0.
- UI: doble-clic (onDblClick) en arista/handle dispara insertar/quitar; si el resultado es
  inválido, se ignora (y opcionalmente un aviso breve). Aplica `setFloorOutline`.

## Tests
- `tests/canvas/outline-edit.test.ts`:
  - insertVertexOnEdge añade 1 vértice y mantiene el polígono cerrado/ortogonal.
  - removeVertex devuelve null si dejaría un polígono inválido; válido si no.
  - isValidOutline detecta auto-intersección y área cero.

## Validación
- tsc + eslint limpios; suite verde.
- Verificación en navegador: añadir un vértice a un rectángulo → convertirlo en L; quitarlo →
  volver al rectángulo; 3D coherente en cada paso.
