# F3 — Keyframes fotorrealistas anclados a la ruta

**Objetivo:** cada waypoint (o punto de interés) produce una imagen fotorrealista que respeta la
geometría exacta de esa pose; la galería del proyecto se convierte en fuente de keyframes.

## Contexto

- Ya existen `generateViewFrom3D` / `saveNativeRender` (render desde captura 3D) y el routing
  `render3d`; falta guardar la **pose de cámara** en el payload del `Deliverable`.
- No hay captura headless de three.js: la captura se hace en cliente (canvas existente).

## Requisitos

1. **Pose en la galería**: `Deliverable.payload.camera = { position, focus, fovDeg, levelId }`
   en todo render generado desde la escena. Renders antiguos sin pose: se anclan a mano
   (pin + dirección sobre el plano) en el panel de galería.
2. **Captura por keyframe** (cliente): para cada waypoint, render off-screen del canvas R3F a
   la pose (`samplePose`), tamaño fijo (p. ej. 1536×864): color + máscara de muros/aperturas
   (segundo pase con material plano) → subida por **URL presignada** (no Server Action) como
   `SourceImage` rol `KEYFRAME` (enum nuevo) con la pose en metadatos; mime/tamaño verificados.
   Prompts: nombres de estancia y materiales entran **sanitizados** y como datos estructurados.
3. **Render IA condicionado**: reutilizar el pipeline `render3d` (imagen→imagen) con la captura
   como control y prompt derivado del inspector: materiales de suelo/muros (`floorFinishes`,
   `materials`), mobiliario del catálogo, estilo elegido (`style-gallery`). Semilla fija por
   recorrido y **referencia de estilo** = keyframe anterior (modelos multi-referencia: Nano
   Banana Pro / Flux Kontext vía routing admin).
4. **Consistencia verificable**: comparación de la máscara de muros de la captura con bordes
   detectados en el render (`detect-walls-raster` sobre el resultado) → puntuación; por debajo
   de umbral, se regenera automáticamente una vez.
5. **Storyboard UI**: tira horizontal de keyframes bajo el editor; regenerar uno, sustituir por
   una imagen de la galería (con pose), reordenar; estado de créditos por keyframe.
6. Créditos: hold por lote de keyframes, débito por imagen completada (patrón `CreditHold`).

## Archivos

- Crear: `src/lib/contracts/walkthrough-keyframe.ts`, `src/components/editor-v2/scene/capture-pose.ts`,
  `src/server/ai/walkthrough/render-keyframe.ts`, `src/server/ai/walkthrough/consistency-score.ts`,
  `src/components/editor-v2/storyboard-panel.tsx`.
- Modificar: `agent-actions.ts` (guardar pose), `zone-photos-panel.tsx` (anclar pose), Prisma
  `SourceImageRole.KEYFRAME`, `deliverable.ts` (payload con `camera`).
- Tests: consistencia (fixtures captura/render), contrato de pose, hold/débito por lote.

## Validación

- 5 keyframes de un mismo recorrido con materiales iguales: puntuación de consistencia ≥ umbral en
  4 de 5; inspección visual documentada en `plans/reports/`.

## Riesgos

- El modelo cambia materiales entre keyframes: mitigación por referencia previa + prompt de
  materiales explícito; si persiste, fijar estilo con LoRA/IP-adapter queda como futuro.
