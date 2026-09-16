# F4 — Vídeo IA entre keyframes (+ F4b voz y efectos)

**Objetivo:** generar el recorrido como vídeo fotorrealista encadenando clips entre keyframes
consecutivos, con el movimiento de cámara derivado de la ruta real; montaje final descargable.

## Contexto

- Proveedores en admin: `kie` (Veo 3.1, Kling 2.5, Hailuo 02 — soportan frame inicial+final),
  `openai` (Sora 2 API, imagen inicial), `nan` (según catálogo que exponga), `openrouter` (sin
  vídeo hoy). Decisión: acción `video` enrutada como las demás; allowlist por proveedor.
- Generación asíncrona (1–5 min por clip): hoy no existe cola de trabajos ni webhooks de kie.

## Requisitos

0. **Spike GO/NO-GO (puerta de la fase)**: antes de construir cola, webhook o wizard, generar 3
   clips reales (tramo recto, giro 45°, paso por puerta) entre keyframes de F3 con el proveedor
   configurado, presupuesto fijo acordado con Paulo, y puntuarlos con `consistency-score`. Si la
   geometría se deforma en 2 de 3, la fase se detiene y F2+F3 quedan como producto; resultado en
   `plans/reports/`.
1. **Acción y routing**: `ModelAction.video` (Prisma + `model-allowlist.ts` + defaults);
   `VideoAdapter` en `src/lib/contracts/video-adapter.ts` con `submit(job) → providerJobId`,
   `poll(id)`, `result(id)`; implementaciones en `src/server/ai/video/providers/{kie,openai,nan}.ts`.
2. **Prompt de cámara desde la ruta**: `camera-motion-prompt.ts` (puro) traduce el tramo entre
   dos poses en instrucciones (dolly in X m, pan Y°, paso por puerta, altura de ojos) + materiales
   + estilo. Equivalente calculado a los "camera presets" de Higgsfield.
3. **Cola de trabajos en BD, sin cron nuevo**: tabla `WalkthroughJob { id, projectId, orgId,
   pathId, status, clips: JSON, holdId, callbackToken, finalKey?, error? }`. El estado avanza
   con `tick(jobId)` invocado desde la acción de polling del cliente (resuelta por org) y desde
   el webhook `api/webhooks/kie?token=…`: el **cuerpo del webhook se ignora**, solo dispara un
   `tick` que consulta el estado al proveedor; descargas solo desde dominios del proveedor.
   Reintento por clip (máx. 2), nunca del vídeo completo. Límites: 1 job activo por proyecto, 3
   por org; duración total ≤ 60 s por vídeo (configurable por plan). Cron opcional después.
4. **Montaje**: `ffmpeg` (añadir a la imagen Docker, ejecutar con `nice`) concat + crossfade
   300 ms + normalización a 1080p/24 fps; salida a storage con URL presignada de descarga →
   `Deliverable` tipo `VIDEO` con payload `{ pathId, clips[], durationS, provider }`.
5. **Asistente de generación** (UI): pregunta zonas (multizona), estilo, duración por tramo,
   resolución, con/sin audio; muestra estimación de créditos antes de confirmar
   (`estimate*` como en `estimateConceptRenderFromEditor`).
6. **Créditos**: hold del total estimado; débito por clip completado; liberación del resto en fallo.
7. **F4b voz y efectos** (aplazable): guion por estancia generado desde la memoria del proyecto
   (`memoria`), TTS por ElevenLabs (nuevo proveedor `elevenlabs` en credenciales admin) y música
   de biblioteca libre subida por el admin (`MediaAsset`); mezcla en el montaje ffmpeg. Si el
   presupuesto o el proveedor no lo permite, se entrega vídeo mudo y F4b pasa a backlog.

## Archivos

- Crear: contratos `video-adapter.ts`, `src/server/ai/video/*`, `camera-motion-prompt.ts`,
  `src/server/video/assemble.ts`, `src/server/jobs/walkthrough-job.ts`, rutas `api/jobs/...`,
  `api/webhooks/kie`, `src/components/editor-v2/walkthrough-wizard.tsx`, migraciones Prisma.
- Modificar: admin `config/models/page.tsx` (acción video), `credits.ts` (precio por clip/segundo).
- Tests: prompt de cámara (tramos rectos, giros, puertas), máquina de estados del job (éxito,
  fallo parcial, reintento, liberación de hold), verificación de firma del webhook, ensamblado.

## Validación

- Recorrido de 4 keyframes → 3 clips → MP4 final reproducible; fallo simulado en clip 2 →
  reintento y no se pierde clip 1; créditos cuadran con el ledger.

## Riesgos

- Coste por segundo alto: mostrar estimación y limitar duración total por plan de suscripción.
- Alucinación de geometría en giros: tramos > 45° se parten en dos keyframes (F3 los genera).
- Cron/webhook en despliegue: verificar en Dokploy antes de dar por cerrada la fase.
