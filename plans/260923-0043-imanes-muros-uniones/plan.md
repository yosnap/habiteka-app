# Plan: imán de muros y uniones fiables

Estado: completado y mergeado en `develop` (2026-09-23)
Informe base: `plans/reports/investigation-260922-2316-imanes-muros-elementos.md`

## Outcome

Al arrastrar un vértice, trazar un muro o mover un muro cerca de una esquina o de otro muro, el resultado queda
unido (vértice compartido o unión en T), colineal o perpendicular, sin esquinas fantasma a 75 mm ni bandas muertas.
Los muebles conservan el comportamiento actual (pegado a caras).

## Restricciones

- No cambiar el esquema del documento ni los contratos de `alignPoints` usados por objetos.
- Ficheros < 1000 líneas; sin commit hasta que Paulo lo pida.
- Tests locales en verde antes de mergear (sin CI remoto).

## No-goals

- Rehacer la UI del editor ni el motor de escenas 3D.
- Cambiar el comportamiento de `snapObject` para muebles, columnas o descansillos.
- Tocar el editor antiguo en `src/canvas/` (canvas-v1).

## Fases

### F1. Nube de referencias estructural (sin caras)

- `magnetic-alignment.ts`: `magneticReferences(doc, exclude, { faces: boolean })`. Con `faces: false` solo eje
  (lado 0) de muros; objetos, huecos, etiquetas y cotas se mantienen.
- Consumidores estructurales pasan `faces: false`: `previewVertex`, `snapWallMove`, caso libre de `snapWallPoint`.
- `snapSpatialDrag`, `snapObject`, `alignRoom`, `opening-placement` siguen con caras.

### F2. Vértice real antes del imán por ejes, con suelo en mm

- Nueva constante compartida (por ejemplo en `snap-candidates.ts`): `snapRadiusMm(scale, px, floorMm = 50)`.
- `previewVertex`: antes del imán por ejes, si hay un vértice (no incidente) dentro del radio 2D, el punto es ese
  vértice y se fusiona. Después, unión en T contra cuerpo de muro dentro del radio (no solo a 0,5 mm).
- `snapWallPoint`: radio de vértice y de eje con el mismo suelo.

### F3. Umbrales de unión coherentes

- `wall-join.ts`: `DANGLING_CORNER_MM` y `endClearanceMm` pasan a ser coherentes con el radio del imán (esquina suelta
  ≤ radio; si el punto proyecta cerca de un extremo, fusionar con ese extremo en vez de descartar).
- `addWallPath`: mismo criterio para reutilizar vértice existente (hoy 0,01 mm) cuando el punto ya viene del imán.

### F4. Rejilla después del imán

- `snapWallMove` y `snapObject`: aplicar la rejilla de 100 mm solo cuando el imán no encontró referencia dentro del
  radio. Para objetos, mantener el ajuste final a cara.

### F5. Tests a escala real

- `tests/editor-v2/wall-snap-scale.test.ts` con `scale = 0.08` y `0.3`: los casos A, B y E del informe deben unir.
- Regresión: `wall-join.test.ts`, `column-snap.test.ts`, `outdoor-attach.test.ts`, `object-host-rest.test.ts` y el
  resto de `tests/editor-v2` y `tests/editor-document` en verde.

## Criterios de aceptación

1. Vértice arrastrado a ≤ 150 mm (zoom 0,08) de una esquina se fusiona con ella; a ≤ 50 mm con zoom 0,6 también.
2. Muro trazado con el extremo a ≤ 150 mm de una esquina comparte vértice; sobre el cuerpo de otro muro, unión en T.
3. Muro movido hasta ≤ 125 mm del eje de otro queda sobre ese eje, nunca sobre su cara.
4. Mueble soltado en un rincón sigue pegado a ambas caras (caso C del informe sin cambios).
5. Suite completa de editor en verde en local.

## Riesgos y rollback

- Riesgo: fusiones no deseadas al mover vértices en planos densos. Mitigación: el vértice destino nunca puede ser
  incidente al arrastrado y la vista previa sigue mostrando la fusión antes de soltar.
- Rollback: los cambios son puros en `src/canvas/editor-v2` y `src/lib/editor-document/wall-join.ts`; revertir la rama.
