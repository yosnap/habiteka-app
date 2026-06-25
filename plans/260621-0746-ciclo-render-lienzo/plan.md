# Ciclo render ⇄ lienzo — conectar la IA con el editor

**Problema:** hoy las dos mitades del producto están desconectadas. El asistente
(`/chat`) genera diseños (`Deliverable`: render3d/plano2d/memoria) y el editor
(`/canvas`) tiene un campo `doc.baseImage` que NADIE rellena. No se puede "aplicar
un diseño al lienzo".

**Decisión de diseño (acordada con el usuario):** la generación principal es
foto real → IA → render (ya funciona; el modelo de visión entiende la escena, no
hay que dibujar el plano a mano). El lienzo pasa a ser herramienta de AJUSTE sobre
el render, no entrada de la IA. Por eso se descarta "dibujar plano → alimentar IA".

**Objetivo:** el usuario quiere "las dos cosas":
1. Render generado como fondo del lienzo (calcar/retocar encima).
2. Elementos detectados poblados como objetos editables del catálogo.

## Estado de las piezas (verificado en código)

- `BaseImage { url, width, height }` y `BaseImageLayer` (capa de fondo) — LISTOS.
- `baseImage` serializa/persiste en `serialize.ts` y `canvas-workspace` autosave — LISTO.
- Render generado = `Deliverable.payload.render3d.assetUrl` (una URL de imagen) — LISTO.
- NO existe acción `setBaseImage` en el store ni UI para aplicarlo — FALTA.
- Ingesta (`phases/ingesta.ts`) detecta solo CONTEOS `{walls,doors,windows,pillars}`,
  no posiciones — INSUFICIENTE para colocar objetos.

## Fases (commit por fase; sin PR hasta que el usuario lo pida)

### CRL-1 · Render → fondo del lienzo  ✅ HECHO
- ✅ Acción `setBaseImage(img | null)` en el store (pasa por `mutate`, entra en historial).
  También `setBaseImageOpacity` (acota a [0,1]).
- ✅ Botón **"Usar como fondo del lienzo"** en el visor de render (`use-as-background-button.tsx`).
  Mide `width/height` naturales en cliente, persiste el fondo en servidor vía Server Action
  `applyBaseImageToCanvas` (preserva trazos/objetos/productos) y navega al canvas. Se eligió
  persistir en servidor + navegar porque canvas y entregables son páginas separadas y el store
  se rehidrata desde servidor.
- ✅ Toolbar del canvas: botón **"Quitar fondo"** visible solo si hay `baseImage`.
- ✅ Control de opacidad del fondo (slider en la toolbar; `BaseImage.opacity` opcional, respetado
  por `BaseImageLayer`). `opacity: 0` es válido (no cae a 1).
- ✅ Resultado usable: generar render → traerlo al lienzo → dibujar/mover muebles encima.
- Verificación: typecheck OK, eslint OK, 19 tests de canvas (4 nuevos de baseImage/opacity),
  suite completa 254 passed. Sin subir `CANVAS_SCHEMA_VERSION` (opacity es campo opcional v1).

### CRL-2 · Detección estructurada → objetos editables
- ACOTADO a imágenes que ya son plano en planta (cenital), donde la detección por
  coordenadas es fiable. Sobre foto en perspectiva la detección de bounding boxes
  es imprecisa (muebles descolocados): se trata como beta/experimento aparte.
- Extender el schema de detección para devolver posiciones (bbox normalizado 0..1)
  además de los conteos actuales (estos quedan como red de seguridad / confirmación).
- Mapear cada elemento detectado a un `StructKind` del catálogo y crear `StructObj`
  (x,y,width,height en coords del lienzo). Insertar con una acción del store.
- Umbral de confianza: si es baja, NO colocar (mejor nada que un desastre).

### CRL-3 · Pulido del ciclo
- Tras generar, ofrecer "traer al lienzo" inline (cierra el bucle desde el chat).
- Bloquear/desbloquear fondo, encajar a stage, opacidad.

### CRL-4 · Lienzo → diseño IA (entrada bidireccional)  ✅ HECHO

**Implementado:** botón "Generar diseño desde el lienzo" en el canvas → mini-formulario
(estilo + render3d) → Server Action `generateDesignFromCanvas` serializa el doc a texto
(`serialize-doc-to-prompt.ts`) y lo rasteriza a PNG server-side con sharp SIN etiquetas
(`server/agent/canvas/rasterize-canvas-doc.ts`) → acción `generate-from-canvas` del
orquestador (ruta directa a entrega, reusa `runDelivery`, gates `assertConsent`+`assertTosAccepted`)
→ `entrega.ts` pasa `referenceImage` + descripción al modelo → persiste render → navega a
/deliverables. No toca la fase del chat (flujo paralelo).
Verificación: typecheck OK, eslint OK, 47 tests agent+canvas. Code-review + verificación
adversarial: 2 críticos y 2 mayores encontrados y CORREGIDOS — IDOR (acotar proyecto por org
en las acciones del agente), clave idempotente por `requestId` único (no por version constante),
validación de estilo/entregable en boundary RSC, `num()` exige `Number.isFinite`.

**Afinamiento de prompts (tras probar con un usuario real):** el primer render colocaba mal la
ventana (encima de la TV), rotaba el sofá y salía cuadrado. Causa: el modelo leía el PNG cenital
como foto frontal y el texto en píxeles no transmitía proporción ni orientación. Corregido con 4
palancas: (1) `serialize-doc-to-prompt` ahora describe SEMÁNTICAMENTE (pared del fondo/frontal,
izq/dcha, orientación horiz/vert, forma de la sala) en vez de coordenadas; (2) declara que es
vista cenital, NO foto frontal; (3) `rasterize-canvas-doc` encuadra al bounding box de la sala y
conserva su proporción real, devolviendo el `aspectRatio` que se pasa a `image.generate` (antes
16:9 fijo) + colores de mueble por tipo; (4) instrucción fuerte de no reordenar/rotar/cambiar de
pared. Resultado verificado: ventana en la pared del fondo con la TV debajo separada, sofá
horizontal, puerta presente, proporción apaisada. Salto claro de fidelidad.


**Decisión revisada con el usuario:** el lienzo SÍ es entrada de la IA, además de la
foto real. Razón: el lienzo lleva datos ESTRUCTURADOS exactos (kind, posición, tamaño y, a
futuro, medidas/escala), así que el agente no adivina desde píxeles — entiende el espacio
mejor que con una foto en perspectiva. Esto sustituye al ítem antes "fuera de alcance".

Entrada al modelo = **texto estructurado + imagen de referencia** (acordado):
- Serializar el doc del canvas a una descripción textual: lista de objetos con `kind`,
  posición y tamaño (y agrupaciones), que enriquece el prompt del render.
- Rasterizar el lienzo a PNG (Konva `stage.toDataURL()` / `toImage()`) y pasarlo como
  `referenceImage` — el contrato `ImageGenRequest.referenceImage { url|base64|mimeType }`
  YA existe (`src/lib/contracts/image-adapter.ts`), pero hoy `generateOne` en
  `entrega.ts` NO lo usa: hay que conectarlo.

Pasos (a detallar en fase aparte si se confirma):
- **Arquitectura (decidido tras /ck:predict): RUTA DIRECTA A ENTREGA, no `ingest-sketch`.**
  El lienzo YA es estructurado, no necesita una fase de detección por visión (ahorra una
  llamada de modelo y su coste). Serializar doc→texto (función pura) + rasterizar→PNG y
  entrar por el flujo de `deliver` reusando `runDelivery`.
- `renderPrompt(input)` en `entrega.ts` debe incorporar la descripción del lienzo; hoy
  solo usa `estilo` + `objetivo` e IGNORA los elementos detectados (arreglarlo mejora
  TAMBIÉN la entrada por foto).
- `generateOne` (caso `render3d`) debe pasar `referenceImage` a `deps.image.generate`.
  El provider real (`nano-banana.ts`, Gemini 2.5 Flash Image) YA consume
  `referenceImage.base64` → el cableado existe end-to-end, solo falta rellenarlo.
- UI: botón **"Generar diseño desde el lienzo"** en la toolbar/canvas que serializa el
  doc, rasteriza el stage (`stage.toDataURL()`, acotar a ~1024px lado mayor) y dispara
  el pipeline (Server Action).
- **Gates legales (innegociables):** reaplicar `assertConsent('IMAGE_PROCESSING')` +
  `assertTosAccepted` + `isReadyForDelivery` — el lienzo rasterizado es imagen procesada.
- Guard de lienzo vacío/incompleto (mínimo de objetos o aviso). Decisión de producto.
- Validar calidad de generación (pendiente también en la entrada por foto).

**Incógnita crítica — VALIDADA con prototipo (✅ DESPEJADA):** el modelo SÍ respeta el
`referenceImage`, con fidelidad alta. Prototipo: `tests/spikes/lienzo-a-render-referenceimage.spike.ts`
generó dos renders de EXAMPLE_SALON — A) texto + referenceImage, B) solo texto (control).
El render A reprodujo la disposición del lienzo (vista en planta, muros, sofá izq-centro,
mesa al centro, lámpara a la derecha); el control B divergió libremente (sofá a la derecha,
otra orientación). Conclusión: la vía texto+referenceImage funciona; CRL-4 es viable.
- **Matiz de diseño (del prototipo):** el modelo copió tan literal la referencia que incluyó
  las ETIQUETAS de texto ('Mesa', 'Sofá') en el render. En CRL-4 hay que rasterizar el lienzo
  SIN etiquetas (solo formas) para que no aparezcan palabras flotando en el render.

Riesgos: coste de créditos (reusar reserva/confirma/revierte de `runDelivery`);
rasterizado en cliente (Konva necesita `window`); tamaño del PNG base64 (acotar resolución).
Veredicto /ck:predict: CAUTION (viable y bien encajado; la única incógnita real es la
fidelidad del referenceImage, aislada al prototipo).

## Notas técnicas
- `ImageGenRequest.referenceImage { url|base64|mimeType }` e `InpaintRequest.baseImage`
  ya aceptan `{ url | base64 }` — esta es la vía para mandar el lienzo a la IA en CRL-4.
- Konva: medir tamaño natural de la imagen antes de `setBaseImage` (con `Image()` o
  `useImage`), porque la capa de fondo escala a partir de `width/height` del doc.
- No subir `CANVAS_SCHEMA_VERSION`: `baseImage` ya forma parte del doc v1.
- Capas del stage: tras consolidar (jun-2026) hay 5 capas (límite Konva 3-5). El contenido
  estático sin interacción (imagen base + trazos) vive junto en `BackgroundLayer` como dos
  `Group`. No añadir más `<Layer>` sin necesidad; preferir `Group` dentro de una capa.

## Orden
CRL-1 ✅ (render→fondo) → CRL-2 (detección→objetos, acotada a planta) → CRL-3 (pulido)
→ CRL-4 (lienzo→diseño IA, entrada bidireccional). CRL-4 puede adelantarse si la
generación desde el lienzo es prioritaria para el usuario.

## Fuera de alcance
- (Ninguno activo.) El antes-descartado "dibujar plano para alimentar la IA" se REABRIÓ
  como CRL-4: el lienzo lleva datos estructurados, no es dibujo vectorial a mano, así que
  aporta valor y mejora la fidelidad frente a la foto en perspectiva.
