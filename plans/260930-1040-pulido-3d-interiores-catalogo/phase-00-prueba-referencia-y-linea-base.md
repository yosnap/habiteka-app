---
title: "Fase 0: Prueba de referencia y línea base"
status: todo
---

# Fase 0: Prueba de referencia y línea base

## Contexto

Sin una medida repetible no se sabe si cada fase acerca a Planner 5D o solo cambia cosas. Habiteka
ya captura vistas desde presets de cámara (`src/lib/editor-document/render-view.ts`,
`CaptureScene` en `src/components/editor-v2/scene/editor-scene-view.tsx:66,239`) y puede fijar
la pose «Vista actual» sin reencuadre (plan integral, fase 3). Esta fase construye el plano de
referencia, las 10 cámaras, la rúbrica y la medición de rendimiento; no toca la escena.

## Requisitos

- Plano de referencia recreado en Habiteka con las mismas estancias, cotas, huecos y objetos que el
  plano visto en Planner 5D (salón con ventana y cortinas, dormitorio con cama vestida, baño con
  mármol, cocina, comedor/pasillo con lámpara colgante, estantería con libros, cuadros, espejo,
  plantas). Lo aporta Paulo o se recrea a partir de sus capturas y cotas (decisión abierta 6).
- 10 cámaras fijas, mismas para Habiteka y Planner 5D, FOV 45°, 1920×1080, preset `daylight`,
  techo oculto y muros recortados según cámara.
- Rúbrica puntuable y presupuesto de rendimiento documentados.

## Archivos

- Nuevo `tests/fixtures/referencia-interiores/documento.json` (EditorDocument del plano de referencia).
- Nuevo `tests/fixtures/referencia-interiores/camaras.json` (10 poses: posición, objetivo, fov, techo, muros).
- Nuevo `src/lib/editor-document/reference-cameras.ts` (≤ 80 líneas): tipo `ReferenceCamera`,
  carga/validación zod del JSON y conversión a los parámetros que acepta `CaptureScene`.
- Nuevo `scripts/reference-capture.mjs`: abre el editor en Chrome headless (mismo patrón que
  `scripts/test-drawing-browser-server.mjs`), carga el fixture, recorre `camaras.json`, guarda
  `plans/reports/referencia-interiores/<fecha>/c01..c10.png` y un `metrics.json`.
- Nuevo `docs/3d-rubrica-referencia.md`: rúbrica, protocolo de evaluación y presupuesto.
- Nuevo `tests/editor-document/reference-cameras.test.ts`.

## Pasos

1. Crear el documento de referencia en el Editor v2 (proyecto local «Referencia interiores») y
   exportarlo al fixture; registrar en `docs/3d-rubrica-referencia.md` qué objetos existen y con
   qué `catalogId`.
2. Definir las 10 cámaras y guardarlas en `camaras.json`:
   C1 cenital sin techo · C2 isométrica SO · C3 isométrica NE · C4 salón hacia ventana/cortinas ·
   C5 salón hacia estantería/TV/cuadros · C6 dormitorio hacia cama vestida · C7 baño hacia
   lavabo/espejo/mármol · C8 cocina hacia frentes/isla · C9 comedor/pasillo con lámpara colgante ·
   C10 detalle a 0,9 m de altura: zócalo, marco de puerta, alfombra.
3. Capturar en Planner 5D las mismas 10 vistas **a mano** (Paulo; capturas de pantalla, solo para
   comparar; no se guardan en el repo ni se reutilizan como activo).
4. Implementar `reference-cameras.ts` + `scripts/reference-capture.mjs`; el script escribe
   además `metrics.json` con `renderer.info` (triángulos, draw calls, texturas, geometrías),
   bytes descargados de `/models` y `/materials`, tiempo hasta primer fotograma con todos los
   modelos y fps medio de 10 s de paseo libre (`free-walk-camera.tsx`) con ruta fija.
5. Redactar la rúbrica y el presupuesto en `docs/3d-rubrica-referencia.md`.
6. Ejecutar la captura sobre el estado actual → línea base `plans/reports/referencia-interiores/base/`.

## Rúbrica (0-5 por criterio, ponderada a 100)

| Criterio | Peso | 0 | 3 | 5 |
|---|---|---|---|---|
| Fidelidad y detalle de objetos | 20 | cajas/placeholder | modelo reconocible, proporción correcta | detalle medio, sin deformación, coherente en estilo |
| Materiales de superficies | 15 | color plano | textura + normal correctas y escala real | familias coherentes, AO, juntas/rugosidad creíbles |
| Iluminación y sombras | 15 | plano, sin sombras | sombra de sol + ambiente | contacto, oclusión, lámparas que emiten, tono agradable |
| Detalle arquitectónico | 10 | muros lisos | marcos en huecos | zócalos, marcos, alféizares, molduras |
| Textiles y cortinas | 10 | cajas | tela con pliegues | pliegues, recogidas, ropa de cama con estampado |
| Vegetación y decoración | 10 | ausente/cajas | plantas y objetos reconocibles | hojas reales, libros, cuadros, espejo, jarrones |
| Coherencia global «vivida» | 10 | maqueta | estancia amueblada | estancia habitada, estilo unificado |
| Rendimiento | 10 | < 20 fps o > 3× presupuesto | dentro de presupuesto en escritorio | dentro en escritorio y móvil |

Protocolo: 3 evaluadores (Paulo + 2), parejas ciegas Habiteka/Planner 5D por cámara, puntuación
independiente, media por criterio. Aprobado: media ≥ 70, ningún criterio < 2, diferencia con
Planner 5D ≤ 10 puntos. Jev puede puntuar como cuarto evaluador con la misma rúbrica para
detectar desviaciones, nunca como único juez.

## Presupuesto de rendimiento (a confirmar con la línea base)

| Métrica | Escritorio (portátil integrado 2022+) | Móvil (iPhone 12 / Android gama media 2022) |
|---|---|---|
| Triángulos visibles | ≤ 1,5 M | ≤ 500 k |
| Draw calls | ≤ 300 | ≤ 150 |
| Memoria de texturas GPU | ≤ 250 MB | ≤ 120 MB |
| FPS en paseo libre 1080p | ≥ 60 | ≥ 30 |
| Primer fotograma útil (4G simulado, sin caché) | ≤ 3 s | ≤ 4 s |
| Por activo (LOD0 / LOD1) | ≤ 15 k / ≤ 3 k triángulos, texturas ≤ 1024², ≤ 600 KB típico, ≤ 2 MB máx. | igual |

## Validación

- `bun run test tests/editor-document/reference-cameras.test.ts` en verde (esquema, 10 cámaras,
  conversión a parámetros de captura).
- `node scripts/reference-capture.mjs --out plans/reports/referencia-interiores/base` produce 10 PNG
  y `metrics.json` con todos los campos.
- Rúbrica rellenada para la línea base (se espera 30-45/100).

## Riesgos

- Paulo no puede recrear el plano exactamente → aceptar equivalencia por estancias y objetos; la
  comparación es de acabado, no de distribución píxel a píxel.
- Headless sin GPU distorsiona fps → medir fps en Chrome con GPU real (manual) y dejar el script
  para geometría/bytes/tiempo de carga.

## Rollback

Todo es aditivo (fixtures, script, doc). Borrar los archivos nuevos revierte la fase.

## Decisiones para Paulo

- Quién recrea el plano de referencia (decisión 6 del índice).
- Dispositivo móvil de referencia concreto para medir.
