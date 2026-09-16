# Plano importado fiel → recorridos visuales (3D nativo, keyframes IA, vídeo IA)

**Rama:** `feat/planos-ia` · **Estado:** PLANIFICADO, PREDICT=CAUTION aplicado (2026-09-16) · **Sucede a:** [260711 planos IA](../260711-1018-planos-ia-boceto-y-render/plan.md)
**Informe de debate, red-team y validación:** [predict-260916-0246](../reports/predict-260916-0246-plano-importado-recorridos.md)

## Restricciones derivadas del debate (obligatorias en todas las fases)

- `Plano2dPayload` queda congelado: F1 entrega un `PlanImportResult` nuevo.
- Todo texto extraído de imágenes (nombres, cotas) se sanitiza antes de entrar en etiquetas o prompts.
- Ficheros grandes (MP4, keyframes) suben por URL presignada a S3, nunca por Server Action (16 MB).
- Toda acción de recorrido/keyframe/job resuelve el recurso por organización (anti-IDOR).
- F2 no usa ffmpeg ni servidor: vídeo en cliente (WebCodecs + mp4-muxer). ffmpeg solo en F4.
- F4 empieza con un spike GO/NO-GO de vídeo IA con presupuesto fijo antes de construir cola/wizard.

## Resultado

1. Un plano **dibujado o creado** (esquemático de arquitecto, CAD exportado, PDF/PNG) entra al
   Editor v2 como documento fiel: muros con grosor real, huecos, estancias con nombre, **medidas
   escritas respetadas** (cotas por estancia y cotas generales), mobiliario del plano colocado
   desde el catálogo. Ejemplo de referencia: planta esquemática 15,60 × 7,55 m con 3 dormitorios,
   2 baños, living/comedor/cocina, loggia, 2 terrazas y cotas interiores por estancia.
2. Sobre ese proyecto (2D + 3D ya existentes) el usuario prepara un **recorrido virtual**: ruta de
   cámara trazada sobre el plano, previsualización 3D instantánea, keyframes fotorrealistas
   anclados a la ruta y vídeo IA entre keyframes (estilo Higgsfield / MiniMax Hailuo), con voz y
   efectos si el proveedor lo permite.

## Decisiones (Paulo, 2026-09-16)

- Orden: **F1 plano importado ANTES** que cualquier recorrido.
- Proveedores de vídeo: los mismos perfiles del admin (`kie`, `openrouter`, `nan`, `openai`);
  nueva acción `video` enrutada como el resto. OpenRouter hoy no ofrece generación de vídeo: en
  la allowlist esa acción queda sin modelos para ese proveedor hasta que los publique.
- Multizona: el asistente de recorrido **pregunta** qué zonas incluir al generar.
- Voz en off y efectos: en alcance (F4b); si no es viable con los proveedores enrutados, se aplaza
  sin bloquear F4a.
- Presupuesto del spike de vídeo IA (F4) y duración máxima de vídeo por plan: **ajustes en el panel
  admin** (`SystemSetting`) con un mínimo aceptable por defecto (spike: 3 clips de 5 s; duración
  máxima: 60 s). El código no hardcodea valores fuera de esos defaults.
- PDF entra en F1, rasterizado en cliente con pdf.js.
- **Listón de fidelidad del plano editable = Planner 5D (Paulo, 2026-09-16):** el plano 2D es la
  fuente de verdad y el 3D sale de él. Debe traer mobiliario (con pieza de catálogo → 3D), luces
  vistas desde arriba, cotas encadenadas por lado (parciales + total), y una capa base de terreno
  editable (césped, tierra, pavimento) sobre la que se colocan el resto de elementos de la parcela.
  Input preferente para importar: el redibujado DECORADO de Flare, no el boceto a lápiz.
- Se mantiene la restricción de producto: lógica nueva desacoplada de la UI actual (contratos +
  server + geometría pura); UI mínima funcional en el Estudio de planos y el Editor v2.

## Fases

| Fase | Entregable | Depende de | Estado |
|------|-----------|------------|--------|
| [F1 — Plano dibujado → documento fiel](phase-01-plano-dibujado-a-documento-fiel.md) | Extracción con cotas escritas + mobiliario + escritura directa en Editor v2; bench offline con planos reales | — | IMPLEMENTADO y probado en navegador (2026-09-16); fidelidad ±5 % pendiente (1–2/13 en CAD real) |
| [F2 — Recorrido 3D nativo](phase-02-recorrido-3d-nativo.md) | Ruta de cámara en el documento, auto-tour, preview walk en three.js, exportación MP4 | F1 | PENDIENTE |
| [F3 — Keyframes fotorrealistas](phase-03-keyframes-fotorrealistas.md) | Captura 3D por pose + render IA condicionado; galería con pose de cámara; storyboard | F2 | PENDIENTE |
| [F4 — Vídeo IA entre keyframes](phase-04-video-ia-entre-keyframes.md) | Acción `video`, adaptador + cola asíncrona, clips first/last frame, montaje ffmpeg; F4b voz y efectos | F3 | PENDIENTE |

## Criterios de aceptación globales

- F1: sobre el banco offline, las dimensiones interiores de cada estancia con cota escrita quedan
  dentro de ±5 % de la cota; muros exteriores e interiores con grosor distinguido; ≥ 80 % del
  mobiliario dibujado colocado en la estancia correcta; el documento abre en Editor v2 sin pasar
  por el canvas legacy.
- F2: un proyecto con ≥ 3 estancias genera auto-tour sin atravesar muros; exportación MP4 1080p.
- F3: cada keyframe conserva la disposición de su captura 3D (comparación visual + prueba de
  regresión sobre máscara de muros).
- F4: vídeo final descargable como entregable `VIDEO`, con créditos retenidos hasta finalizar y
  fallo recuperable (reintento por clip, no por vídeo completo).

## Qué se reutiliza

- Pipeline de boceto: `src/server/ai/sketch/*`, `src/server/plan/detect-walls-raster.ts`,
  `normalize-geometry.ts`, `detect-room-regions.ts`, adaptador `fromPlano2d` a Editor v2.
- Editor v2: `EditorDocument` (muros con `hidden`, `floorFinishes` por estancia, `labels`,
  `dimensions`, `furniture`), catálogo `furniture-catalog.ts`, escena R3F con presets de cámara.
- IA: `getImageAdapterForAction`, routing por acción en admin, spend-guard, costes, kie ya integrado.
- Persistencia: `document-repo.ts` (autoridad editor), `Deliverable`, `SourceImage`, storage S3.

## Riesgos transversales

- Fidelidad de visión sobre planos variados: por eso F1 vive en banco offline y la IA solo aporta
  semántica (nombres, cotas leídas, mobiliario); la geometría sale del raster.
- Modelos de vídeo alucinan geometría en giros amplios: keyframes cada 2–3 m y clips de 3–5 s.
- Generación asíncrona (minutos): hace falta cola de trabajos + reanudación; hoy no existe.
