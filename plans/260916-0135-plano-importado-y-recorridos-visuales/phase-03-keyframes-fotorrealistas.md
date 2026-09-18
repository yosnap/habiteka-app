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

## Avance — 18/09/2026

Completado el acceso individual desde puntos del recorrido y contrato de cámara persistida.
El panel permite **Diseñar desde este punto**: abre 3D, captura posición/altura/orientación
validada, muestra techo y paredes físicos y reutiliza el diálogo existente. Cambiar iluminación
o preparar Vista actual conserva la pose. Otros ángulos siguen siendo capturas independientes.

Render IA desde escena y PNG nativo conservan `payload.camera` (posición, foco, FOV y planta).
Coordenadas relativas a planta; capturas globales se normalizan con `levelElevationM`.
No se altera el documento ni se llama a proveedores hasta la acción explícita de generación.

Pendiente para cerrar F3: anclaje manual de imágenes antiguas, capturas/máscaras presignadas
KEYFRAME, storyboard persistido, reserva/débito por lote, semilla/referencia anterior, evaluación
de consistencia y reintento, validación visual de cinco generaciones reales.

Validación de este incremento: 247 pruebas/41 archivos, typecheck/lint y build; navegador
desde punto1 + cambio día/noche; PNG guardado y cámara verificada en BD.
[Informe](../reports/impl-260918-0016-vistas-desde-recorrido-report.md).

### Secuencia de vistas — 18/09/2026

Añadida tira horizontal bajo el editor para seleccionar puntos, añadir todos, quitar y
reordenar vistas sin modificar el trayecto. Selección persistida en cada recorrido mediante
`storyboardWaypointIds` opcional; documentos existentes compatibles. Hereda guardado,
deshacer/rehacer y separación por planta. Borrar un punto elimina su referencia editorial.
«Diseñar esta vista» reutiliza la captura y diálogo existentes, con cámara derivada del plano
actual, sin consumo de créditos al organizar la lista.

Este incremento guarda la selección y el orden; aún falta asociar resultados/miniaturas,
sustituir desde galería, créditos por imagen y generación por lotes. F3 sigue en curso.
Validación: 234 pruebas/39 archivos, typecheck y lint; navegador añadir, reordenar y sincronizar.

### Imágenes asociadas a las vistas — 18/09/2026

Cada vista puede guardar un entregable y la cámara original en `storyboardImages`. Al generar
la vista actual desde un punto se vincula el resultado si el plano y la cámara siguen siendo
los mismos. Un cambio concurrente conserva el render en Diseños y muestra aviso, sin fallar
una generación ya terminada. Otros ángulos del diálogo no sobrescriben la vista original.

La tira incluye miniatura, abrir resultado, regenerar y sustituir desde galería. La galería
usa entregables del proyecto/organización/zona autorizados y URLs firmadas frescas; ofrece
solo imágenes con cámara compatible. Imágenes antiguas sin pose necesitan el anclaje manual
pendiente. Cambiar un punto marca su resultado como encuadre desactualizado. Quitar una vista
no elimina el entregable de Diseños.

Validación: 248 pruebas/42 archivos, typecheck y lint. Navegador: carga del selector, galería y
mensaje sin imágenes compatibles. No se ha lanzado generación pagada para probar asociación
automática extremo a extremo. Quedan lotes/hold, capturas/máscaras, consistencia y anclaje manual.
