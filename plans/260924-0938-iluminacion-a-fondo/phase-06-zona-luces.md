# Fase 6 · Zona de luces dibujada en el plano

Esfuerzo: 4h · Depende de: fases 2, 3 y 5 · Estado: pending

## Contexto

El selector de zonas del render ya resuelve todo el dibujo: tres modos
(estancia, punto a punto, rectángulo), cierre del trazo, autointersección,
simplificación y estancia bajo el cursor (`render-region-draw.ts`, con
`MAX_REGIONS = 12` y `REGION_MODES` en `:24-27`), con su UI en
`render-region-picker.tsx` + `render-region-map.tsx`. El contrato de salida es
un polígono en milímetros de 3 a 20 vértices
(`render-design-options.ts:12-15`).

`insideRoom(point, boundary)` (`ceiling-geometry.ts:101`) ya hace punto en
polígono.

## Requisitos

1. Marcar **una** zona en el plano desde el panel de iluminación, con los
   mismos tres modos del selector de render (reutilización, no copia).
2. La zona es **efímera**: vive en el estado del panel/tienda de UI, no en el
   documento. Cerrar el panel o cambiar de proyecto la olvida.
3. Con zona activa:
   - «Seleccionar luces de la zona» selecciona luminarias cuyo centro cae
     dentro y tiras cuyo recorrido resuelto interseca la zona.
   - La edición en bloque existente opera sobre esa selección sin cambios.
   - «Proponer luces en la zona» limita `proposeLighting` a la zona (fase 7).
4. La zona se dibuja en 2D con el mismo trazo que el selector de render para
   que el usuario la reconozca.
5. Sin zona, todo funciona exactamente como hoy.

## Ficheros

Crear:
- `src/lib/editor-document/lighting-zone.ts` — `lightsInZone(doc, polygon)` y
  `stripsInZone(doc, polygon)`; reutiliza `insideRoom` y un test
  segmento-polígono para tiras.
- `src/components/editor-v2/lighting-zone-section.tsx` — la sección del panel,
  montando el componente de dibujo ya existente.

Modificar:
- `src/components/editor-v2/render-region-picker.tsx` /
  `render-region-map.tsx` — extraer lo reutilizable si hoy están acoplados a
  las opciones de render (objetivo: un componente de dibujo de zona con
  `value`/`onChange`, sin conocer el render). Si el acoplamiento es mínimo,
  basta con parametrizar `maxRegions = 1` y el texto.
- `src/components/editor-v2/ceiling-lighting-panel.tsx` — montar la sección.
- `src/components/editor-v2/ceiling-lighting-layer.tsx` — pintar la zona activa.

Tests: `tests/editor-document/lighting-zone.test.ts` (nuevo),
`tests/editor-document/render-region-draw.test.ts` (no debe cambiar).

## Pasos

1. Revisar `render-region-picker.tsx` y decidir extracción vs. parametrización
   (KISS: si el componente ya recibe `value`/`onChange`, parametrizar).
2. `lighting-zone.ts` puro con tests.
3. Sección del panel con los tres modos y el botón de selección.
4. Pintado de la zona en la capa 2D de iluminación.
5. Comprobar que el selector de zonas del render sigue idéntico (test de
   regresión ya existente).

## Validación

```bash
DATABASE_URL=… bun run scripts/test-isolated.ts run \
  tests/editor-document/lighting-zone.test.ts \
  tests/editor-document/render-region-draw.test.ts
```

Casos: luminaria justo en el borde (criterio documentado: dentro); luminaria
fuera; tira que cruza la zona parcialmente (cuenta); tira totalmente fuera
(no); zona sobre una estancia completa selecciona todas sus luces; zona vacía
devuelve lista vacía sin error.

## Riesgos

- **Refactor del selector de render rompiendo el render** (prob. media, impacto
  alto): es código en producción de la funcionalidad de zonas de render.
  Mitigación: cambio mínimo, y los tests de `render-region-draw` y
  `render-design-options` deben pasar sin tocarlos.
- **Confusión entre zona de luces y zona de render** (prob. media, impacto
  bajo): distinguir con color y textos («Zona de luces» vs. «Zonas
  permitidas»).
- **Persistencia esperada por el usuario** (prob. media): si Paulo quiere que
  la zona sobreviva al cierre del panel, es una decisión abierta (ver informe).

## Rollback

Revertir; nada se persiste, así que no hay datos que limpiar.

## Propiedad de ficheros

Exclusiva sobre `lighting-zone*`. Comparte `ceiling-lighting-panel.tsx` y
`ceiling-lighting-layer.tsx` con fases anteriores: esta fase va después.
