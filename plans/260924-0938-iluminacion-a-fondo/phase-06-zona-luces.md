# Fase 6 · Zonas de luces guardadas en el proyecto

Esfuerzo: 5h · Depende de: fases 2, 3 y 5 · Estado: pending

## Contexto

El selector de zonas del render ya resuelve todo el dibujo: tres modos
(estancia, punto a punto, rectángulo), cierre del trazo, autointersección,
simplificación y estancia bajo el cursor (`render-region-draw.ts`, con
`MAX_REGIONS = 12` y `REGION_MODES` en `:24-27`), con su UI en
`render-region-picker.tsx` + `render-region-map.tsx`. El contrato de salida es
un polígono en milímetros de 3 a 20 vértices
(`render-design-options.ts:12-15`), el mismo que usa `LightZone` (fase 1).

`insideRoom(point, boundary)` (`ceiling-geometry.ts:101`) ya hace punto en
polígono.

## Requisitos

1. Las zonas de luces **se guardan en el documento** (`doc.lightZones`, fase 1):
   tienen nombre, se reutilizan entre sesiones y sobreviven a recargar el
   proyecto.
2. Gestión completa desde el panel de iluminación: crear (con los tres modos de
   dibujo), renombrar, redibujar, borrar y elegir la zona activa. Máximo 12.
3. Con una zona activa:
   - «Seleccionar luces de la zona» selecciona luminarias cuyo centro cae
     dentro y tiras cuyo recorrido resuelto interseca la zona.
   - La edición en bloque existente opera sobre esa selección sin cambios.
   - «Proponer luces en la zona» limita `proposeLighting` a la zona (fase 7).
4. Las zonas se dibujan en 2D con el mismo trazo que el selector de render y
   con su nombre, distinguibles de las zonas permitidas del render (color y
   texto distintos).
5. Sin zonas definidas, todo funciona exactamente como hoy.
6. Borrar luces o tiras no invalida ninguna zona: las zonas son geometría, no
   listas de ids.

## Ficheros

Crear:
- `src/lib/editor-document/light-zone-commands.ts` — `addLightZone`,
  `renameLightZone`, `setLightZonePolygon`, `removeLightZone` (todas sobre
  `upgradeLightingDocument` y cerrando con `parseEditorDocument`; nombre
  duplicado → error con mensaje en castellano).
- `src/lib/editor-document/lighting-zone.ts` — `lightsInZone(doc, polygon)` y
  `stripsInZone(doc, polygon)`; reutiliza `insideRoom` y un test
  segmento-polígono para tiras.
- `src/components/editor-v2/lighting-zone-section.tsx` — lista de zonas
  guardadas, zona activa y el componente de dibujo.

Modificar:
- `src/components/editor-v2/render-region-picker.tsx` /
  `render-region-map.tsx` — extraer lo reutilizable si hoy están acoplados a
  las opciones de render (objetivo: un componente de dibujo de zona con
  `value`/`onChange`, sin conocer el render). Si el acoplamiento es mínimo,
  basta con parametrizar el máximo y los textos.
- `src/components/editor-v2/ceiling-lighting-panel.tsx` — montar la sección.
- `src/components/editor-v2/ceiling-lighting-layer.tsx` — pintar las zonas
  guardadas y resaltar la activa.

Tests: `tests/editor-document/lighting-zone.test.ts` y
`tests/editor-document/light-zone-commands.test.ts` (nuevos),
`tests/editor-document/render-region-draw.test.ts` (no debe cambiar).

## Pasos

1. Revisar `render-region-picker.tsx` y decidir extracción vs. parametrización
   (KISS: si el componente ya recibe `value`/`onChange`, parametrizar).
2. `lighting-zone.ts` puro con tests.
3. Comandos de zona (alta, renombrado, redibujado, borrado).
4. Sección del panel: lista con nombre, zona activa (estado local, no
   documento), botones de gestión y el selector de modo de dibujo.
5. Pintado de zonas en la capa 2D de iluminación.
6. Comprobar que el selector de zonas del render sigue idéntico (test de
   regresión ya existente).

## Validación

```bash
DATABASE_URL=… bun run scripts/test-isolated.ts run \
  tests/editor-document/lighting-zone.test.ts \
  tests/editor-document/light-zone-commands.test.ts \
  tests/editor-document/render-region-draw.test.ts \
  tests/editor-document/validation.test.ts
```

Casos: luminaria justo en el borde (criterio documentado: dentro); luminaria
fuera; tira que cruza la zona parcialmente (cuenta); tira totalmente fuera
(no); zona sobre una estancia completa selecciona todas sus luces; zona vacía
devuelve lista vacía sin error; alta con nombre repetido → error; renombrar a
un nombre libre funciona; borrar una zona no toca luces ni tiras; guardar y
volver a parsear el documento conserva las zonas intactas; 13ª zona → error.

## Riesgos

- **Refactor del selector de render rompiendo el render** (prob. media, impacto
  alto): es código en producción de la funcionalidad de zonas de render.
  Mitigación: cambio mínimo, y los tests de `render-region-draw` y
  `render-design-options` deben pasar sin tocarlos.
- **Confusión entre zona de luces y zona de render** (prob. media, impacto
  bajo): distinguir con color y textos («Zonas de luces» vs. «Zonas
  permitidas»). Son colecciones distintas a propósito: una es del documento,
  la otra de las opciones de un render.
- **Zona obsoleta tras remodelar el plano** (prob. media, impacto bajo): la
  zona es geometría fija; si el usuario mueve muros puede quedar descolocada.
  Mitigación: se puede redibujar sin perder el nombre
  (`setLightZonePolygon`); no se borra sola.

## Rollback

Revertir los ficheros de esta fase. Las zonas guardadas quedan como datos
inertes que siguen validando (fase 1); no afectan al 3D ni al prompt.

## Propiedad de ficheros

Exclusiva sobre `lighting-zone*` y `light-zone-commands.ts`. Comparte
`ceiling-lighting-panel.tsx` y `ceiling-lighting-layer.tsx` con fases
anteriores: esta fase va después.
