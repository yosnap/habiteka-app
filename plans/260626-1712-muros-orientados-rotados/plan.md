# Plan: Muros orientados rotados (contornos no ortogonales con 3D correcto)

**Estado:** PENDIENTE
**Creado:** 2026-06-26
**Dependencia:** F2 (interacción 3D) completada

## Problema

El editor de contorno permite mover vértices libremente (moveVertexFree) creando diagonales y triángulos. Pero el 3D no representa bien las esquinas: los muros drawn (segmentToWall) tienen grosor CENTRADO, y las cajas 3D no cubren el cuadrado de la esquina (el grosor debe ir HACIA FUERA del polígono, como los wizard).

Los intentos de parche (cajas orientadas desde floorOutline, centro del floorOutline, extensión 2t) no resolvieron el problema: desfase de centro, ángulos incorrectos, suelo desalineado.

## Solución: nuevo tipo de muro "orientado rotado"

Un muro orientado rotado tiene:
- **Rotación arbitraria** (como drawn).
- **Grosor hacia fuera** del polígono (como wizard).
- **Meta con normal exterior** (nx, ny) para que el render sepa hacia dónde va el grosor.

### Archivos a modificar/crear

1. **`src/canvas/draw-wall.ts`**: `segmentToWallOriented(id, p1, p2, scale, thickness, normalOut)` → muro con grosor hacia `normalOut`, `drawn: false`, `meta: { nx, ny, oriented: true }`.

2. **`src/canvas/wizard/room-shapes.ts`**: `outlineToWalls` generalizado — para aristas diagonales, usar `segmentToWallOriented` en vez del axis-aligned actual.

3. **`src/canvas/wizard/outline-edit.ts`**: `moveVertexFree` (ya existe) para mover vértices sin forzar ortogonalidad.

4. **`src/canvas/canvas-store.ts`**: `setFloorOutline` usa `outlineToWalls` generalizado (soporta diagonales).

5. **`src/components/canvas/object-shapes.tsx`**: `wallPolygon` para muros orientados (meta.oriented) — grosor hacia un lado (no centrado), usando meta.nx/ny.

6. **`src/components/canvas/layers/wall-junction-caps.tsx`**: `wallGeom` para muros orientados — normal desde meta.nx/ny, endpoints correctos.

7. **`src/canvas/3d/doc-to-scene.ts`**: `wallEndpointsXZ` / cajas 3D para muros orientados — centro desplazado por normal*t/2 (grosor hacia fuera). Extensión de esquina +t en convexas.

8. **`src/canvas/3d/floor-from-walls.ts`**: `floorPolygonFromWalls` para muros rotados — o caer siempre a `floorOutline` cuando hay orientados.

### Riesgos

- El render 2D (wallPolygon) y el miter (computeWallMiters) están diseñados para wizard (axis-aligned) o drawn (centrado). Un muro orientado rotado no encaja en ninguno — necesita una rama nueva.
- El suelo 3D (floorPolygonFromWalls) rasteriza bboxes axis-aligned; para muros rotados no funciona → usar floorOutline.
- Aperturas (ventanas/puertas) en muros orientados: associateOpening y splitWallWithOpenings deben funcionar con rotación.

### Validación

- Test: contorno con diagonal (triángulo) → docToScene genera cajas que cubren esquinas.
- Test: contorno ortogonal (L) → mismo resultado que antes (regresión).
- Visual: editar contorno creando triángulo → 3D cierra esquinas.
