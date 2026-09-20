# F1 — Plano dibujado o creado → documento fiel en Editor v2

> **Estado 2026-09-16: IMPLEMENTADO Y PROBADO DE PUNTA A PUNTA; FIDELIDAD PENDIENTE** (informe:
> [`plans/reports/impl-260916-plano-importado-f1.md`](../reports/impl-260916-plano-importado-f1.md)).
> Flujo verificado en navegador: subida → extracción → tabla → envío → Editor v2 (2D y 3D). Test de
> autoridad legacy→editor en verde con BD de pruebas. NO cumple aún el criterio ±5 % por estancia
> (1–2 de 13 en el CAD real): siguiente iteración = anclaje global de estancias a líneas de muro,
> offline con la extracción guardada. Sin commit.

**Objetivo:** un plano esquemático/CAD (imagen o PDF) se convierte en `EditorDocument` fiel:
muros con grosor real, huecos, estancias nombradas, cotas escritas respetadas, mobiliario colocado.

## Contexto (estado real del código)

- `extractPlanCore` ya combina visión (semántica) + raster (`detectWallsFromImage`, geometría).
- Huecos actuales del pipeline frente al plano de ejemplo (planta 15,60 × 7,55 m):
  1. El prompt ordena **ignorar mobiliario** → no se extrae ni se coloca.
  2. Solo hay escala global (`anchoMetros/altoMetros`); las **cotas por estancia** ("3.0 x 4.0m")
     y las cotas generales (7.55 / 15.60) no se leen ni se usan como restricción.
  3. El raster devuelve un solo grosor; el ejemplo tiene fachada gruesa y tabiques finos.
  4. Zonas semiabiertas (terrazas, loggia) no cierran región → se pierden o se fusionan.
  5. `sendPlanoToEditor` escribe en el **canvas legacy** (`canvasState`) y el Editor v2 lo
     convierte con autoridad `legacy`; pierde estancias/mobiliario y mezcla dos autoridades.
- Existe `fromPlano2d` (adaptador Plano2dPayload → EditorDocument) con `labels` por zona.
- `Wall.hidden` permite límites lógicos de estancia sin muro físico (terrazas/loggia).
- `FloorFinish.roomId` y el catálogo `furniture-catalog.ts` (kinds con dimensiones reales).

## Requisitos

1. **Contrato ampliado** (`RawSketch` / `SKETCH_SCHEMA`), compatible hacia atrás:
   - `cotas`: lista `{ texto, valorMetros[], tipo: 'estancia'|'general', ancla: {x,y} | muro }`.
   - `mobiliario`: lista `{ tipo (vocabulario cerrado mapeable a FurnitureProfile), bbox 0–1,
     rotacionDeg, habitacion? }`.
   - `habitaciones[].exterior?: boolean` (terraza, loggia, patio) y `habitaciones[].anchoMetros /
     altoMetros?` cuando la cota va escrita dentro de la estancia.
   - Prompt: nueva variante `planPrompt()` para planos limpios (no boceto), que sí pide
     mobiliario y cotas; el modo se elige por heurística del raster (nº de bandas largas) o por
     el botón de la UI.
2. **Grosor por clase**: el detector raster devuelve el grosor de banda por muro; la normalización
   agrupa en 2 clases (k-means 1D) → exterior ≈ 200–300 mm, interior ≈ 80–120 mm.
3. **Ajuste métrico por cotas (determinista)**:
   - Escala global: si hay cotas generales, se resuelve px/m por eje con ellas (prioridad sobre
     `anchoMetros` estimado); `escalaEstimada=false`.
   - Cotas por estancia: para cada región con cota escrita se compara el interior medido con la
     cota; si desvía > 3 %, se desplazan los muros de esa estancia (solo los no compartidos con
     estancias ya ajustadas) hasta cumplirla. Solver simple por ejes, sin librerías.
   - Discrepancias no resolubles → avisos en UI, nunca forzadas.
4. **Zonas exteriores/semiabiertas**: región abierta con nombre exterior se cierra con muros
   `hidden: true` sobre la línea discontinua/borde detectado; recibe `FloorFinish` propio y
   `kind` exterior (vocabulario `zone-kinds.ts`).
5. **Mobiliario**: bbox 0–1 → mm; se elige la entrada del catálogo por `profile` + estancia
   (`FurnitureRoom`) + mejor ajuste de tamaño; se coloca centrado en el bbox con rotación
   cuantizada a 90°; se descarta si queda fuera de su estancia o solapa un muro (usa
   `furniture-volumes.ts`).
6. **Salida directa a Editor v2**: nueva Server Action `importPlanToEditor(projectId, result)`
   que construye el `EditorDocument` (extender `fromPlano2d` con furniture, floorFinishes y
   dimensions) y guarda vía `document-repo` con autoridad editor. `sendPlanoToEditor` legacy
   queda solo para compatibilidad y se marca deprecado.
7. **Entrada PDF**: rasterizar la primera página **en cliente** con pdf.js cargado bajo demanda →
   PNG → mismo flujo. Cero parseo de PDF en servidor. Si no cabe en F1, se aplaza explícitamente.
8. **UI mínima en PlanoStudio**: botón "Importar plano dibujado" → superposición de vectores
   extraídos sobre la imagen original (SVG existente con opacidad) → **tabla editable de
   estancias** (nombre, ancho, alto) precargada con lo leído por el modelo; el solver usa lo que
   quede en la tabla, así la fidelidad no depende de la lectura del modelo → toggle "importar
   mobiliario" → avisos de cotas → campo de escala si `escalaEstimada` → "Enviar al editor".
9. **Contrato de salida**: `Plano2dPayload` NO cambia (congelado). Nuevo
   `PlanImportResult { plano, furniture, exteriors, writtenDimensions, warnings, escalaEstimada }`
   en `src/lib/contracts/plan-import-result.ts`.
10. **Sanitización**: nombres y cotas leídos de la imagen pasan por `sanitize-extracted-text.ts`
    (lista blanca de caracteres, máx. 40 chars) antes de entrar en etiquetas o prompts.
11. **Autoridad de documento**: la importación crea/reemplaza `EditorDocumentState` y fija el
    `legacyFingerprint` del `canvasState` actual para que el editor no reconvierta; guarda revisión
    previa para deshacer; la UI pide confirmación si ya hay documento editor.

## Archivos

- Modificar: `src/server/ai/sketch/sketch-types.ts`, `extract-sketch-geometry.ts` (schema +
  `planPrompt`), `normalize-geometry.ts` (grosor por clase, exteriores),
  `src/server/plan/detect-walls-raster.ts` (grosor por muro).
- Crear: `src/server/ai/sketch/fit-to-dimensions.ts` (solver de cotas, puro),
  `src/server/ai/sketch/place-furniture.ts` (bbox → catálogo, puro),
  `src/lib/editor-document/adapters/plano2d-import.ts` (Plano2d + mobiliario + finishes → doc),
  `src/server/plan/import-plan-to-editor.ts` (orquestación server).
- Crear: `src/lib/contracts/plan-import-result.ts`, `src/server/ai/sketch/sanitize-extracted-text.ts`,
  `src/components/plano-studio/room-dimensions-table.tsx`, `src/components/plano-studio/pdf-to-png.ts`.
- Modificar: `agent-actions.ts` (acción nueva), `plano-studio.tsx` (botón + overlay + tabla).
  `plano2d-payload.ts` NO se toca.
- Tests: `tests/ai/fit-to-dimensions.test.ts`, `tests/ai/place-furniture.test.ts`,
  `tests/ai/sanitize-extracted-text.test.ts`, `tests/editor-document/plano2d-import.test.ts`,
  `tests/server/import-plan-legacy-authority.test.ts` (proyecto con `canvasState` previo),
  ampliar `sketch-extract.test.ts`.
- Banco offline: `tests/fixtures/plans/` con el plano de ejemplo y 4–6 más aportados por Paulo;
  `tests/canvas/extract-offline.visual.test.ts` extendido para volcar el JSON de estancias con
  medidas medidas vs escritas (las escritas van en un sidecar `.json` por fixture, cero créditos).

## Pasos

1. Fixtures + sidecar de cotas esperadas.
2. Grosor por muro en raster + clases.
3. Contrato y schema ampliados + prompt de plano.
4. Solver de cotas con tests.
5. Exteriores con `hidden`.
6. Colocación de mobiliario.
7. Adaptador a EditorDocument + Server Action con autoridad editor.
8. UI PlanoStudio.
9. Bench con visión (opt-in, `scripts/verify-studio-live.ts` ampliado) sobre las fixtures;
   resultados en `plans/reports/`.

## Validación

- Unit: solver (cota cumple, desvía, muro compartido, sin cota), mobiliario (fuera de estancia,
  solape, rotación), adaptador (ids estables, finishes por estancia).
- Offline: cada fixture cumple ±5 % en estancias con cota; informe automático de desviaciones.
- Manual: importar el ejemplo, abrir Editor v2, mover un muro y comprobar que huecos y mobiliario
  siguen anclados; vista 3D coherente (fachada gruesa visible).

## Riesgos y rollback

- Visión lee mal una cota → el solver la ignora si contradice la escala global > 15 %; aviso en UI.
- Cambio de autoridad de guardado: probar con proyecto con canvas legacy previo (se conserva
  `canvasState`). Rollback: la acción nueva es aditiva; la antigua sigue disponible.
