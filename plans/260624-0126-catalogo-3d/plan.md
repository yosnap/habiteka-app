# Plan: Catálogo de muebles en vista 3D

**Estado:** PENDIENTE  
**Rama:** fix/asistente-atasco-generacion  
**Objetivo:** El usuario puede agregar elementos del catálogo directamente desde el overlay 3D; al agregar, el mueble aparece en el centro de la sala y el gizmo de mover se activa automáticamente.

---

## Contexto

La vista 3D ya permite seleccionar, mover, rotar, duplicar y borrar muebles.  
Lo que falta es el punto de entrada: hoy el usuario debe salir al 2D, añadir desde el catálogo 2D y volver al 3D.

## Alcance

| Dentro | Fuera |
|--------|-------|
| Categorías: sanitarios, cocina, mobiliario, electrónica, decoración, iluminación | Categoría `estructura` (paredes/puertas: no relevantes en 3D) |
| Posición inicial = centro de la sala (planCenterPx) | Placement por clic en el suelo 3D (ray-cast) |
| Auto-seleccionar + activar gizmo translate al añadir | Buscar / filtrar catálogo |

## Fases

| Fase | Descripción | Archivos |
|------|-------------|----------|
| F1 | Panel catálogo en overlay 3D | ver `phase-01-panel.md` |

## Dependencias

- `addObject` del store ✓
- `CATALOG`, `CatalogEntry` de `canvas/catalog.ts` ✓
- `catalogSizePx` de `canvas/scale.ts` ✓
- `isLight` + `defaultLight` de `canvas/light.ts` ✓
- `computePlanCenter`, `resolvePxPerMeter` de `canvas/3d/doc-to-scene.ts` ✓
- `use3DSelection` → `select` + `setMode` ya en `plan-3d-overlay.tsx` ✓

## Criterios de aceptación

1. Botón "+" en el overlay 3D abre/cierra el panel de catálogo.
2. El panel muestra las categorías (tabs) y los ítems de cada categoría.
3. Clic en ítem → objeto aparece en 3D centrado en la sala → gizmo translate activo.
4. TypeScript limpio, ≥ 601 tests en verde.
