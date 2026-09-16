# F2 — Recorrido 3D nativo (sin IA)

**Objetivo:** el usuario traza una ruta de cámara sobre el plano 2D, la previsualiza en la escena
3D existente y exporta un vídeo. Es la base geométrica de F3/F4 y un entregable por sí mismo.

## Contexto

- Escena R3F en `src/components/editor-v2/scene/` con `SceneCamera` (presets, fit) y OrbitControls.
- `EditorDocument` es la única fuente de verdad; los recorridos viven en él (coordenadas mm,
  como el resto) para sobrevivir al rehacer la UI.
- Estancias detectables por `floorFinishes` + regiones cerradas (`detect-room-regions` es server;
  hace falta versión cliente-safe sobre el documento).

## Requisitos

1. **Contrato** en `src/lib/editor-document/walkthrough.ts`:
   `WalkthroughPath { id, name, levelId?, zoneIds?, waypoints: { id, x, y, eyeHeightMm, yawDeg?,
   pitchDeg?, lookAt?: Point, dwellMs, speedMmPerS }[], loop: boolean }`; `EditorDocument.walkthroughs?`.
   schemaVersion +1 con migración (campo opcional).
2. **Geometría pura** (`walkthrough-geometry.ts`): spline Catmull-Rom por waypoints, muestreo por
   longitud de arco, orientación (tangente o lookAt), `samplePose(t) → { position, focus }`.
   Colisión: `clampToRooms` desplaza la muestra fuera de muros usando el grafo de muros; si un
   tramo cruza muro sin hueco, se marca el tramo como inválido.
3. **Auto-tour** (`auto-tour.ts`): centroide de cada estancia + centro de cada puerta; orden por
   grafo de adyacencia (BFS desde la entrada o la estancia mayor); ruta que entra por puertas.
   El asistente pregunta qué zonas incluir (decisión multizona).
4. **UI Editor v2**: modo "Recorrido" en la barra lateral: pintar waypoints en el canvas Konva
   (capa nueva `walkthrough-layer.tsx`), arrastrar, editar altura/pausa en el inspector; en 3D,
   botón Play que anima `SceneCamera` con `samplePose` (nuevo `action: 'walk'` con reloj).
5. **Exportación MP4 100 % en cliente** (resolución del debate): render **frame a frame a tiempo
   fijo** (no `captureStream`, no tiempo real) forzando `invalidate()` por frame sobre el canvas
   con `preserveDrawingBuffer` ya activo → codificación H.264 con **WebCodecs** → contenedor con
   `mp4-muxer` → subida por **URL presignada** a S3 (`Content-Type`/`Content-Length` fijados) →
   registro como `Deliverable` tipo `VIDEO` (enum nuevo) tras verificar el objeto. Sin ffmpeg ni
   transcodificación en servidor. Fallback si WebCodecs no está disponible: aviso y navegador
   compatible (Chrome/Edge/Safari 17+).
6. Créditos: exportación nativa sin coste de IA; registrar `UsageEvent` de render local.
7. Anti-IDOR: acciones de recorrido resuelven proyecto y ruta por organización.

## Archivos

- Crear: `src/lib/editor-document/walkthrough.ts`, `walkthrough-geometry.ts`, `auto-tour.ts`,
  `src/components/editor-v2/walkthrough-layer.tsx`, `walkthrough-panel.tsx`,
  `src/components/editor-v2/scene/walk-camera.tsx`, `src/components/editor-v2/scene/offline-recorder.ts`
  (WebCodecs + mp4-muxer), `src/server/storage/presigned-upload.ts`,
  `src/server/actions/walkthrough-actions.ts`.
- Modificar: `schema.ts` + `migrations.ts`, `scene-camera.tsx` (acción walk), `editor-shell.tsx`
  (modo), `prisma/schema/base.prisma` (`DeliverableType.VIDEO`) + migración.
- Tests: geometría (spline, arco, colisión), auto-tour (orden, puertas), migración de schema.

## Validación

- Unit sobre geometría; integración: documento de 3 estancias → auto-tour sin tramo inválido.
- Manual: reproducir en 3D, exportar 10 s a 1080p, abrir el MP4.

## Riesgos

- Rendimiento de captura en portátiles: limitar a 30 fps y resolución elegida.
- Rutas por escaleras/niveles: fuera de alcance (un nivel por recorrido).
