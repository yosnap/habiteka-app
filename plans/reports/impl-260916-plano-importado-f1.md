# Implementación F1 — plano dibujado/CAD/PDF → documento fiel en Editor v2

Plan: `plans/260916-0135-plano-importado-y-recorridos-visuales/` · Rama `feat/planos-ia` · 2026-09-16

## Qué se construyó (sin tocar contratos congelados)

| Pieza | Fichero | Qué hace |
|---|---|---|
| Grosor por muro | `src/server/plan/detect-walls-raster.ts`, `src/server/ai/sketch/wall-thickness.ts` | El raster mide el grosor de cada banda; se reasigna por solape tras la limpieza y se agrupa en 2 clases (fachada/tabique) con k-means 1D. |
| Saneado de texto | `src/server/ai/sketch/sanitize-extracted-text.ts` | Nombres/cotas leídos de la imagen → rótulo corto de caracteres de plano (anti inyección de prompt). |
| Extractor ampliado | `sketch-types.ts`, `extract-sketch-geometry.ts` | `planPrompt()` para planos dibujados; schema y parsers de `cotas`, `mobiliario`, `exterior`, medidas por estancia. `extractSketchGeometry(chat, parts, 'plano')`. |
| Escala fiable | `normalize-geometry.ts` (`resolveScale`) | Con `escalaFiable`, ancho/alto declarados son los de la CAJA DE MUROS; sin saneo de plausibilidad. `normalizeSketchDetailed` expone la escala. |
| Solver de cotas | `src/server/ai/sketch/fit-to-dimensions.ts` | Mínimos cuadrados por eje sobre líneas de muro; cotas por estancia + general; tolerancia 3 %, máx. 15 %; residuo y avisos. Primera línea anclada. |
| Exteriores | `src/server/ai/sketch/exterior-zones.ts` | Terraza/patio/porche desde el polígono del modelo; lados sin muro → límites ocultos. |
| Mobiliario | `src/server/ai/sketch/place-furniture.ts` | Caja 0–1 → mm; entrada de catálogo por perfil + estancia + tamaño; recoloca desbordes pequeños, descarta el resto con aviso. |
| Contrato | `src/lib/contracts/plan-import-result.ts` | `PlanImportResult` (plano + medidas escritas + correcciones + exteriores + mobiliario + avisos). `Plano2dPayload` intacto. |
| Orquestación | `src/server/plan/build-plan-import.ts`, `extract-plan-source.ts` | Pura y testeable; la acción de boceto reutiliza `extractPlanSource` (DRY). |
| Adaptador | `src/lib/editor-document/adapters/plano2d-import.ts` | Extiende `fromPlano2d`: muros `hidden` para exteriores, mobiliario con `catalogId`, acabado `tile` en la estancia derivada; sube por la cadena oficial de migraciones a v7. |
| Autoridad editor | `src/server/plan/import-plan-to-editor.ts` | Legacy → `activate` con huella del snapshot; v2 → `save` revisión nueva. Nunca toca `canvasState`. |
| Acciones | `studio-actions.ts`: `importPlanStudio`, `refitPlanImportStudio`, `applyPlanImportStudio` | Org + consentimiento + ToS; la extracción cruda se guarda en `StudioState.planImport` para recalcular sin IA. Overrides saneados. |
| UI | `src/components/plano-studio/plan-import-panel.tsx`, `pdf-to-png.ts` | Subida imagen/PDF (pdf.js en cliente), superposición, tabla de cotas editable, toggle mobiliario, avisos, envío con confirmación. Botón en el estudio. |

Dependencia nueva: `pdfjs-dist@6.3.289` (solo cliente, carga bajo demanda).

## Verificación

- `tsc --noEmit`: limpio. ESLint sobre los ficheros tocados: sin errores.
- Tests unitarios nuevos: `wall-thickness` (6), `sanitize-extracted-text` (4), `sketch-extract` (+5), `fit-to-dimensions` (6), `place-furniture` (6), `exterior-zones` (3), `plano2d-import` (2), `build-plan-import` (2). Todos en verde junto con los existentes de `tests/ai`, `tests/editor-document`, `tests/canvas` y `tests/contracts`.
- Banco offline (`tests/canvas/extract-offline.visual.test.ts`, ahora vuelca `*.summary.json`): 5 fixtures PNG en `tests/fixtures/plans/` con sidecars `.expected.json`. Clases de grosor obtenidas: CAD limpio 150/80 mm, arquitecto 160/80, esquemático a mano 110–140/80. Salidas en `plans/reports/offline-260916/`.
- NO ejecutado (Postgres de pruebas apagado en la sesión): `tests/server/import-plan-legacy-authority.test.ts` (nuevo), `model-config-loader`, `gateway-fallback`. NO ejecutado: bench con visión (gasta créditos) ni prueba manual en navegador ni `next build` (pdf.js worker vía `new URL(..., import.meta.url)`; verificar en el primer build).

## Decisiones tomadas en implementación

- Solver por mínimos cuadrados en lugar de "ripple" muro a muro: reparte correcciones entre estancias que comparten muro y no rompe con cotas contradictorias.
- Zonas exteriores que ya existen como estancia reutilizan su id; sus lados sin muro siguen generando límite oculto.
- PDF: primera página, 2400 px de lado, fondo blanco forzado; el PDF nunca sube al servidor.
- Toggle de mobiliario en la UI y colocación "mejor ausente que atravesando muro".

## Próximos pasos

1. Arrancar Postgres de pruebas y correr `tests/server/import-plan-legacy-authority.test.ts` + suite completa.
2. Prueba manual: `/projects/[id]/plano` → «Importar plano dibujado (CAD / PDF)» con `tests/fixtures/plans/plano-cad-limpio-1.png` y el PDF; comprobar tabla, superposición y apertura en Editor v2 (fachada gruesa visible en 3D, terraza con suelo de baldosa).
3. Bench con visión (opt-in, créditos) sobre las 6 fixtures; anotar fidelidad por fixture frente a los sidecars.
4. Commit cuando Paulo lo pida (ver memoria: no commitear sin pedirlo).

## Prueba manual 2026-09-16 (sesión nocturna) — resultado

Entorno: dev server 3040, Postgres 5440, MinIO recreado desde `docker compose up -d minio minio-init`
(los contenedores arrancados sueltos desde la UI no publicaban puertos ni creaban el bucket).

Flujo completo verificado en navegador con `tests/fixtures/plans/plano-cad-limpio-1.png`:
subida → extracción (visión + raster) → tabla con 13 estancias y sus medidas escritas correctas →
recalcular sin IA → enviar al editor → Editor v2 activado (revisión 0, 72 muros, 19 huecos,
14 muebles, 14 etiquetas, esquema 7) → plano visible en 2D con fachada gruesa/tabiques finos.

Fallos encontrados y corregidos por el camino:
- Subida de PNG grande rechazada por React Flight (`Maximum array nesting exceeded`, límite 1e6
  chars en argumentos de Server Action): `prepare-upload.ts` codifica ahora PNG→JPEG dentro de
  un presupuesto de 900k chars; también aplica al PDF rasterizado. Fallo preexistente.
- Aberturas superpuestas tras ajustar muros: `aperture-cleanup.ts`.
- Muros cruzados sin vértice compartido (validación de topología): `planarize-plano.ts` (nivel
  plano) y `planarize-walls.ts` (nivel documento, para límites ocultos). Ids con sufijos distintos.
- Bucle de re-render en el editor (`Maximum update depth exceeded`) con documentos sin `columns`:
  `column-layer.tsx` usaba `?? []` en el selector (array nuevo por lectura). Corregido con
  referencia estable y el adaptador inicializa `columns`. Fallo preexistente latente.
- El panel retoma la extracción guardada (`StudioState.planImport`) al recargar, sin IA.
- Zonificación `rooms` (cajas del modelo ancladas a muros medidos, tabiques ausentes creados) en
  `zones-from-rooms.ts`; umbral de corrección 60 % en modo estancias; exteriores fuera del solver.
- Paquete `server-only` añadido (Next lo espera; faltaba para tests/scripts).

Fidelidad (criterio ±5 % por estancia) sobre el CAD real: 1–2 de 13. NO cumple el criterio de
aceptación de F1. Causa: anclaje local de lados a líneas equivocadas → restricciones entre líneas
incorrectas. Extracción cruda guardada en `plans/reports/offline-260916/cad-limpio-1.import.json`
para iterar offline (script `refit-offline` reproduce sin créditos).

## Comparativa con ChatGPT (boceto "Nuestra casa") — 2026-09-16

Paulo obtuvo con ChatGPT un plano 2D estilizado y una maqueta 3D fieles al boceto. Habiteka tiene
el mismo pipeline (Estudio: redibujado + cenital, imagen→imagen). Cambios:
- Añadido `gpt-image-2-5-flare-image-to-image` (kie) al proveedor y a la allowlist del admin;
  puesto como primario de `render3d` en la BD de dev (antes: Sunburst en posición 0; Sunburst
  deja de estar en la ruta, sigue en la allowlist).
- Proyecto `Prueba boceto Flare` (cmu3h6yye0002gmmsjuiq8u8t): redibujado en 30 s, fiel
  (todas las estancias, puertas, ventanas, terraza); cenital en 55 s equivalente a la de ChatGPT.
  Imágenes: `plans/reports/offline-260916/esquematica-1-flare-redraw.png` y `…-flare-cenital.png`.
- Extracción raster sobre el redibujado Flare: 105 bandas detectadas → 16 muros tras limpieza y
  6 regiones (de 11 estancias). La pérdida está en la limpieza topológica, no en la detección ni
  en el modelo. `detectWallsFromImage` admite ahora `minRunRatio` (bajarlo no cambia el resultado).
  Siguiente iteración de fidelidad: revisar `collapseDoubleWalls`/`dropSmallComponents` con poché
  grueso y arcos de puerta; o extraer del redibujado con el modo `rooms` (cajas del modelo).

## Iteración de fidelidad imagen→imagen — 2026-09-16 (madrugada)

Cambios tras la revisión de Paulo (ventanas inventadas, sin mobiliario ni medidas en el redibujado;
puertas leídas como huecos anchos y sin ventanas/sanitarios en el render):
- `redraw-plan-pipeline.ts`: modos `tecnico` (estructura, para extraer) y `decorado` (mobiliario,
  sanitarios, mesa exterior, escala, superficie, norte, acabado de presentación). Nuevo bloque
  `planFidelityRules()` compartido: puertas con hoja + arco en su sitio y sentido, hoja 80–90 cm;
  ventanas solo donde el original; muros 25–30 / 10–12 cm a escala; medidas escritas respetadas.
- `room-prompt-builder.ts` / `cenital-pipeline.ts`: `vista: 'cenital' | 'maqueta'` (isométrica) y
  referencia doble: el ORIGINAL manda (muebles/sanitarios), el redibujado técnico acompaña para la
  geometría. Antes el render solo veía el redibujado estructural.
- Estudio: selector de modo junto a "Redibujar con IA" y selector "Tipo de vista" en el panel de
  estilo; `StudioState.redrawMode` / `vista`.
- Tests: +2 en redraw, +1 en cenital (prompt de maqueta, referencia doble). tsc/lint limpios.

Prueba con `plano-esquematica-2.png` (boceto con cotas, proyecto `Prueba boceto 2 Flare`,
cmu3m71om0000zbmsx6deb13p): redibujado decorado fiel (todas las estancias con sus cotas, muebles,
sanitarios, mesa del jardín, notas, ventanas solo donde estaban, puertas con arco).
Imagen: `plans/reports/offline-260916/esquematica-2-flare-decorado.png`. Maqueta: `…-maqueta.png`.

### Maqueta v2 (reglas de render: una hoja por puerta, sin arco; ventanas donde se dibujan)

Resultado PEOR que la v1 (`esquematica-2-flare-maqueta-v2.png`): el modelo giró la isometría,
perdió fidelidad de distribución, siguió dibujando hojas curvas/dobles y multiplicó ventanas; además
salió a 1024×768 frente a 3312×2480 de la v1. Conclusión: la semántica de puertas (arco = símbolo,
no objeto) NO se controla de forma fiable por prompt con GPT Image; cada tirada es una lotería.
Vía determinista: la maqueta debe partir de una CAPTURA de la escena 3D del editor (puertas de una
hoja y ventanas exactas por construcción) y usar la IA solo para el acabado (es la F3 del plan). Esa
vía depende de la fidelidad de la extracción a geometría editable (F1), que sigue abierta.

CORRECCIÓN: la maqueta v2 NO la generó Flare. Flare falló (`provider_down`, 20 s, tarea kie
fallida) y la ruta cayó al respaldo `flux-2/flex-image-to-image` (1K, peor fidelidad). La v3, ya con
Flare (98 s), aplica las reglas de render: una hoja por puerta sin arco (la mayoría correctas, la de
entrada aún doble), ventanas acristaladas en fachada donde el boceto las marca, sanitarios y mesa del
jardín en su sitio. `esquematica-2-flare-maqueta-v3.png`. Riesgo de producto: el respaldo silencioso
a un modelo más débil devuelve un resultado peor sin avisar; conviene mostrar en la UI qué modelo
sirvió cada imagen (el dato ya está en `ImageResult.generation`).

### Vía completa boceto → redibujado decorado (Flare) → importación → Editor v2 → 3D (2026-09-16)

Importado `esquematica-2-flare-decorado.png` con "Importar plano dibujado" en `Prueba boceto 2 Flare`:
11 estancias con nombre y medidas escritas leídas, 12 muebles colocados, 1 zona exterior, 2 avisos.
Caja general 11,48 × 8,30 m frente a 12,00 × 8,50 escritos (~4 %). Documento v2: 71 muros, 19 huecos,
12 muebles, 11 etiquetas; abre en 2D y 3D. Mucho mejor que importar el boceto a lápiz: el redibujado
limpio es el input correcto para el raster. Quedan tabiques desplazados en la zona Recibidor/Baño y
el jardín exterior anclado a un muro inferior en vez de a la fachada.

## Anclaje global de estancias — 2026-09-16 (mañana)

Objetivo: punto 1 de la sesión anterior (fidelidad ±5 % por estancia). Banco offline nuevo,
sin IA: `tests/canvas/plan-import-fidelity.test.ts` lee `tests/fixtures/plans/*.raw.json`
(extracción cruda modelo + muros medidos, volcada de `project.studioState.planImport` de los
proyectos «Prueba importación F1» y «Prueba boceto 2 Flare») y compara cada estancia con su
sidecar `*.expected.json`. Escribe `plans/reports/offline-260916/*.fidelity.json`.

| Fixture | Antes | Después | Restantes |
|---|---|---|---|
| `plano-cad-limpio-1` (CAD) | 2/12 | **10/12** | Vestidor y Recibidor: cotas incompatibles del dibujo (1,20+1,80+tabique ≠ 3,50 del dormitorio con el que comparten muros; Recibidor comparte las dos líneas del Salón con cota 3,00 frente a 4,00) |
| `plano-esquematica-2-flare-decorado` | 2/10 | **5/10** | Fila superior (3,50+3,00+3,00+2,50+tabiques) no cabe en los 12,00 de fachada que sí cumple la inferior; Baño 2,00 + Recibidor 2,50 ≠ Cocina 3,50; Pasillo sin medida leída («1,00 de ancho» no llegó como cota) |

Las estancias restantes están marcadas en el sidecar con `cotaIncompatible` / `cotaNoLeida` y su
motivo; el banco exige que TODAS las demás cumplan (regresión real). Se siguen midiendo y listando.

Causas encontradas y corregidas (cuatro, encadenadas):
1. **Escala anisótropa** (`normalize-geometry.ts`, `reliableScale`): la cota vertical general del
   CAD (10,50) abarca terraza y entrada, no la caja de muros → el eje Y salía un 8 % inflado. Ahora
   la escala fiable es un solo factor (la imagen no deforma ejes); entre las dos cotas generales se
   elige la que concuerda con la escala implícita en las medidas escritas por estancia (mediana).
2. **Anclaje lado a lado** (`zones-from-rooms.ts`): cada estancia elige el PAR de líneas (o lado sin
   línea) de coste mínimo = error de posición + 1,5 × error frente a la medida escrita. Sin cota,
   se comporta como antes (línea más cercana). Contornos con el grosor real del muro de cada lado.
3. **Identidad de línea por coordenada** (`fit-to-dimensions.ts`): el solver fusionaba tramos
   colineales sin contacto (fondo de Dormitorio 3 y tabique cocina/comedor) y encadenaba cotas
   incompatibles. Ahora una línea = tramos que se tocan (≤ 300 mm) además de coincidir en
   coordenada; el desplazamiento de cada punto depende de qué línea abarca su coordenada
   perpendicular; cada contorno viaja con SUS dos líneas.
4. **Solver**: las cotas ya cumplidas entran como anclas (antes el reparto deformaba estancias
   correctas); la cota general pesa 0,2 y se descarta si desvía > 15 % (`maxGeneralCorrection`,
   la general de un plano suele abarcar más que los muros); rechazo iterativo de la cota de mayor
   residuo (> 8 %) con aviso «no es compatible con las de las estancias vecinas».

Tests: +3 solver (líneas independientes, rechazo con aviso, general descartada), +2 anclaje
guiado, +1 escala isotrópica, +2 banco de fidelidad. `tsc --noEmit` y ESLint limpios. Suite
`tests/ai + tests/canvas + tests/server/build-plan-import + import-plan-legacy-authority`:
verde salvo fallos AJENOS y preexistentes: `model-config-loader` (3, defaults de modelo en BD),
`gateway-fallback` (red), `editor-v2-wall-split › copy stair` («Campo desconocido»).

Pendiente de esta línea: probar en navegador (recalcular sin IA en los dos proyectos); la
extracción del modelo no devuelve cotas de un solo valor («1,00 de ancho») como medida de
estancia — regla candidata: cota `estancia` de un valor anclada dentro de una estancia sin medidas
= su lado corto. Sin commit (pendiente de que Paulo lo pida).

### Corrección: «Extraer geometría» fallaba en proyectos ya en editor v2 (2026-09-16)

Error en el estudio: «Este plano usa el editor v2; no admite escritura legacy». Causa:
`extractPlanFromSketch` (solo lee la imagen) y `sendPlanoToEditor` (escribía en `canvasState`)
pasaban por la puerta legacy `assertProjectInOrg`; tras importar un plano el proyecto queda en v2 y
la puerta lo rechazaba. Cambios en `agent-actions.ts`: la extracción solo comprueba organización;
el envío al editor escribe con autoridad de editor vía `importPlanToEditor` (activa v2 si el
proyecto es legacy, revisión nueva si ya es v2; nunca toca `canvasState`). Cierra el hallazgo de la
memoria. Test `editor-legacy-authority` actualizado (el envío crea revisión v2 y el snapshot legacy
sigue bloqueado); ese fichero fallaba ya antes por el guard `server-only` al importar Server
Actions en vitest: mockeado.

### Alternar entre redibujado técnico y decorado (2026-09-16)

Problema (Paulo): generó el técnico y el decorado, envió el decorado al editor (mal resultado por
la vía antigua de bocetos, sin cotas) y al volver no podía recuperar el técnico: el estudio sólo
guardaba el último redibujado en `plan`. Cambios: `StudioState.redraws` conserva el último
redibujado de cada modo (URLs resueltas en `loadStudio`); `redrawStudio` guarda en su modo;
nueva acción `selectRedrawStudio(projectId, mode)` activa el redibujado ya generado como `plan`
(y descarta plano extraído y cenital, que dependían del otro). UI: el selector de modo alterna
al redibujado guardado (opciones marcadas «· generado») y una leyenda bajo la imagen dice qué se
muestra y que «Extraer geometría» y la vista cenital usan esa imagen. Fuente nueva (subida, dibujo,
canvas) vacía los redibujados.

### Una sola vía de extracción + importar el redibujado del estudio (2026-09-16, tarde)

Retirada la vía antigua de bocetos del estudio (`extractStudio`, `scaleStudio`,
`extractPlanFromSketch`, `extractPlanFromRedrawn`, `extractPlanCore`): sólo medía muros por raster con
estrategia `regions`, sin estancias ni cotas, y daba planos vacíos por la derecha. Ahora:
- `importStudioPlanStudio(projectId, { includeFurniture })`: importa la imagen ACTIVA del estudio
  (redibujado técnico/decorado u original) por `buildPlanImport`, sin descargar ni subir; conserva
  fuente y redibujados; guarda `planImport.image` para la superposición del panel.
  `importPlanStudio` (subida/PDF) comparte el núcleo `importPlanFromImage`.
- Estudio: tarjeta «Llevar al editor» → botón «Importar este plano» (mobiliario activado si el modo
  es decorado) que abre el panel con la tabla de medidas. La pestaña «Editable» y «Enviar al editor»
  directo quedan sólo para el dibujo a mano del sketchpad (plano determinista sin IA).
- Panel: campo «Ancho total real (m)» cuando la escala es estimada; `refitPlanImportStudio` acepta
  `generalWidthMm` y `buildPlanImport` fija con él una escala fiable isotrópica (test nuevo).
- tsc/eslint limpios; `build-plan-import`, `studio-repo`, banco de fidelidad y autoridad legacy en verde.
Pendiente: prueba en navegador del botón nuevo con los dos redibujados.

### Visor del estudio con navegación del editor (2026-09-16, tarde)

`src/components/plano-studio/plan-image-viewer.tsx`: visor común para las tres pestañas (plano,
editable, cenital) con barra abajo a la izquierda como el lienzo del editor (−, %, +, «Encuadrar»,
«Mano»), rueda para zoom sobre el puntero (listener no pasivo por ref con limpieza), arrastre con
la mano, encuadre automático al cargar y al cambiar el tamaño del hueco (ResizeObserver). La página
del estudio pasa a `h-[calc(100dvh-7rem)] overflow-hidden`: el plano ya no provoca scroll de página.
Leyenda sobre la imagen: qué redibujado se muestra y aviso cuando el modo elegido no está generado.

### Reconstrucción DESDE LAS ESTANCIAS (2026-09-16, tarde) — `plan-from-rooms.ts`

Problema (captura de Paulo con el redibujado técnico): muros que no cierran, tabiques sueltos,
ventanas en el borde del jardín, puertas mal puestas. Causa de fondo: los muros salían del raster
(fragmentado) y las estancias se anclaban encima; cada fallo del raster era un agujero.
Ahora las estancias SON el plano (`src/server/ai/sketch/plan-from-rooms.ts`):
1. Rejilla global por eje: coordenadas de todos los vértices de estancia agrupadas (±0,012) y
   posadas sobre el muro medido más cercano (±0,03) cuyo recorrido solape → dos estancias que
   comparten pared comparten línea; el raster sólo afina la posición.
2. Polígonos posados en la rejilla (rectilíneos, sin puntos redundantes). Muros = aristas de
   estancias interiores partidas en las uniones en T; tramos idénticos de vecinas → un muro con dos
   dueños. Las aristas sólo exteriores (jardín) no generan muro (límite oculto vía `exterior-zones`).
3. Grosor: clase medida del raster si hay banda; si no, fachada cuando un lado no tiene estancia y
   queda fuera de la caja interior, tabique en otro caso. Ventanas sólo en muros de fachada.
4. Cuerpo de medida: si la caja del polígono supera la cota escrita > 12 % (el modelo anexó armario o
   tramo de pasillo), la zona mide el mayor rectángulo inscrito; los muros siguen el polígono completo.
5. Pistas de línea para el solver (`lineHints`): muros medidos partidos donde cruzan un vacío interior
   ENCERRADO (pasillo sin estancia leída); un retranqueo de fachada no parte. Así el solver sabe que la
   fachada es un solo muro (sin islas) pero dos filas separadas por pasillo pueden discrepar.
`normalize-geometry.ts`: `prepareSketch` (limpieza + huecos + semillas + escala) exportado y
reutilizado; `normalizeSketchDetailed` queda para bocetos sin estancias (regiones).
`fit-to-dimensions.ts`: mínimos cuadrados REPONDERADOS (Huber, 6 iteraciones, umbral 5 %, peso mínimo
0,05) en lugar de rechazo en cascada: un grupo de cotas incompatibles reparte el desajuste; la general
pesa 0,2; identidad de línea con `lineHints`; contornos rectangulares mapeados por lados (sin sesgos).

Banco de fidelidad (todas las estancias con cotas compatibles cumplen ±5 %):
CAD 9/12 (Vestidor, Recibidor, Baño común, Dormitorio principal: cotas incompatibles del dibujo, con
motivo en el sidecar). Flare decorado 5/10 (fila superior 3,50+3+3+2,50 no cabe en 12,00; Baño 2 +
Recibidor ≠ Cocina; Pasillo sin cota leída). Renders: geometría cerrada y consistente en ambos.
Verificado en navegador: «Continuar importación» del proyecto Flare → tabla + superposición limpia →
«Enviar al editor» → Editor v2 abre el plano con estancias, áreas, mobiliario y jardín. Tests: +5
`plan-from-rooms`, solver adaptado; suites ai/canvas/editor-document/contratos/importación en verde.
Fixtures crudos actualizados desde la BD (`plano-esquematica-2-flare-decorado.raw.json`, 10 estancias).

Otros de la tarde: selector técnico/decorado identifica imágenes por clave de asset (las URL firmadas
cambian); «Traer el plano del editor» rasteriza el documento v2 (antes fallaba en proyectos migrados);
visor con navegación abajo a la izquierda (`plan-image-viewer.tsx`), sin scroll de página.
Pendiente: `zones-from-rooms.ts` queda sin uso en producción (sólo tests) → retirar en limpieza;
Baño 2 del Flare queda en 1,16 m por contradicción del dibujo (corregir en la tabla).

### Ajustes tras revisión de Paulo en el editor (2026-09-16, 14:50)

- Importación SOLO ESTRUCTURA por defecto: «Importar este plano» no coloca mobiliario y el panel trae
  el toggle desactivado (los muebles leídos aparecían sobre muros).
- Sin cotas importadas: el editor acota en vivo; las del plano duplicaban rótulos.
- Importar desde fichero ya no borra los redibujados del estudio (era la causa de «el selector no
  cambia»: en «Prueba boceto 2 Flare» la subida del decorado como fuente había vaciado `redraws`;
  sólo «Prueba importación F1» conserva técnico y decorado).
- Selector: opciones «· no generado» y aviso rojo junto al selector cuando el modo elegido no existe.

### Puertas y sentido de apertura (2026-09-16, 15:20) — plano «Nuestra casa» (técnico Flare)

Paulo: geometría «casi idéntica» pero faltaban 5 puertas, el arco de las puertas al revés y un
«agujero» entrada→pasillo. Causa de las puertas: con muros medidos sólo se aceptaban las aberturas
del modelo que coincidían con un HUECO del raster; una puerta dibujada con su hoja no abre hueco.
Ahora (`plan-from-rooms.ts`): se anclan por separado las aberturas de huecos y las del modelo y se
fusionan por muro (misma abertura si distan < 600 mm); ventanas sólo en fachada. El «agujero» era la
puerta entrada↔pasillo que faltaba. Resultado: 10/10 puertas del original.
Sentido de apertura: nuevo `src/lib/plan-svg/door-swing.ts` (hacia la estancia a la que se entra, no
hacia pasillo/recibidor/entrada/distribuidor; puerta exterior hacia dentro; entre dos estancias
normales, hacia la menor). Lo usan el SVG del estudio y el adaptador al editor (`opening.swing`).
Fixture nuevo `tests/fixtures/plans/plano-nuestra-casa-flare-tecnico.raw.json` (sin sidecar de
cotas: el plano no las trae; sirve para renders y regresión de puertas).
Observación de Paulo en el editor: el patio (límite oculto) comparte vértices con el muro del
comedor y se mueve con él → tema de edición del editor, pendiente.

### Scroll de página en el editor (2026-09-16, 16:20)

Causa: `.shell` del editor calculaba su altura como `calc(100dvh - 80px)`, un número fijo que
asumía la altura de la cabecera + las pestañas del proyecto; la cabecera real mide más, así que el
shell sobraba ~18 px y la página entera ganaba scroll, tapando la barra de zoom de abajo. El estudio
de planos tenía el mismo patrón (`calc(100dvh - 7rem)`).

Arreglado sin números mágicos, con flexbox de verdad:
- `src/app/layout.tsx`: `body` pasa de `min-h-full` (crece sin límite) a `h-dvh overflow-y-auto`
  (altura fija de viewport, con su propio scroll si el contenido es más alto — igual que antes para
  páginas largas, verificado en `/proyectos`).
- `src/app/(app)/projects/[id]/layout.tsx`: los dos contenedores flex del layout del proyecto llevan
  `min-h-0`, así cada hijo recibe el hueco que sobra bajo cabecera y pestañas en vez de forzar a
  crecer al padre.
- `.shell` (editor): `height: calc(100dvh - 80px)` → `flex: 1` (llena ese hueco exacto).
- Estudio de planos (`plano/page.tsx`): `h-[calc(100dvh-7rem)]` → `h-full min-h-0`.

Verificado en navegador: editor y estudio sin scroll de página (`scrollHeight === clientHeight`);
`/proyectos` conserva su scroll normal. tsc limpio.
