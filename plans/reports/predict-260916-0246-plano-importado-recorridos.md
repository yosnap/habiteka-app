# Prediction Report: plano importado fiel → recorridos visuales (plan 260916-0135)

## Verdict: CAUTION

Plan viable; ninguna persona pide rediseño. Seis conflictos resueltos abajo, cuatro obligan a
cambiar el plan antes de arrancar (contrato congelado, subida de vídeo, ffmpeg en F2, spike de
vídeo IA antes de construir cola).

### Agreements (todas las personas)

- Orden F1 → F2 → F3 → F4 correcto: sin plano fiel los recorridos son demo, no producto.
- Geometría siempre determinista (raster + solver); IA solo semántica y acabado. Coherente con
  la lección del loop de julio.
- Guardar el plano importado con autoridad editor (`document-repo`), no en `canvasState`.
- Recorridos dentro de `EditorDocument` (mm) para sobrevivir al rehacer la UI.
- Créditos con `hold/settle/revert` existente, por lote (F3) y por clip (F4); nunca por vídeo entero.
- Multizona se pregunta en el asistente; un nivel por recorrido.

### Conflicts & Resolutions

| Tema | Architect | Security | Performance | UX | Devil's Advocate | Resolución |
|---|---|---|---|---|---|---|
| Ampliar `Plano2dPayload` a schemaVersion 2 | `fromPlano2d` declara el contrato congelado; bump toca entrega/rasterizado/tests | — | — | — | Innecesario | **No tocar `Plano2dPayload`.** Nuevo `PlanImportResult { plano, furniture, exteriors, writtenDimensions, warnings }` en contracts; el adaptador nuevo lo consume. |
| PDF en F1 | Sharp no rasteriza PDF sin libvips+poppler; cambio de imagen Docker | Parsear PDF en servidor abre superficie (parsers) | — | Usuarios de arquitecto entregan PDF | Aplazar | **PDF en cliente** con pdf.js cargado bajo demanda → PNG → mismo flujo. Cero parseo server. Si se complica, se aplaza sin bloquear F1. |
| Lectura de cotas por el modelo de visión | — | — | — | Si falla, el usuario no tiene salida | **Supuesto de carga:** el modelo lee bien "3.0 x 4.0m". Si no, el solver no tiene datos | Solver acepta cotas del modelo **o del usuario**: tabla editable de estancias (nombre, ancho, alto) en la UI antes de enviar. F1 no depende de la lectura del modelo. |
| Mobiliario en F1 | Acopla importación a catálogo | — | — | Mal colocado molesta más que ausente | Recortar | Se mantiene (pedido explícito) pero **opcional** (toggle "importar mobiliario") y nunca bloquea; ítems marcados con `dimensionalOrigin: 'raster'` para distinguirlos. |
| Exportación MP4 en F2 (ffmpeg server) | ffmpeg no está en Dockerfile; despliegue Dokploy cambia | Subida de WebM grande vía Server Action (límite 16 MB) rompe o hay que subir el límite | Transcodificar en el contenedor de la app compite con Next | Espera larga tras grabar | WebCodecs lo hace en cliente | **F2 sin ffmpeg:** captura de frames + WebCodecs (H.264) + `mp4-muxer` en cliente → MP4 directo; subida por **URL presignada** a S3, nunca por Server Action. ffmpeg solo en F4. |
| Cola de trabajos F4 (cron + webhook) | Infra nueva | Webhook sin firma verificable en kie → spoof | — | El usuario debe poder cerrar la pestaña | Construir cola antes de saber si el vídeo IA sirve es prematuro | **Spike acotado** (3 clips, presupuesto fijo) al inicio de F4 como puerta GO/NO-GO. Cola en BD avanzada por `tick` desde acciones del cliente (polling) y por webhook con **token por trabajo en la URL** cuyo cuerpo se ignora: el estado se lee siempre del proveedor. Cron opcional después. |
| `frameloop="demand"` vs grabación | — | — | Con `demand` la captura de frames no avanza sola | — | — | Durante reproducción/grabación forzar `invalidate()` por frame o `frameloop="always"` temporal (ya hay `preserveDrawingBuffer`). |

### Risk Summary

| Riesgo | Severidad | Señal temprana | Mitigación |
|---|---|---|---|
| Nombres de estancia/cotas leídos de la imagen se inyectan en prompts (F3/F4) | Alta | Texto raro en etiquetas tras importar | Sanitizar: lista blanca de caracteres, longitud máx. 40, y nunca concatenar texto libre en prompts sin envolver como dato. |
| Dos autoridades de documento (legacy + editor) | Alta | `El plano legacy cambió` al abrir | La importación crea `EditorDocumentState` y fija `legacyFingerprint` del snapshot actual; test de integración con proyecto legacy previo. |
| Subidas grandes (MP4, keyframes) por Server Action | Alta | Error 413 / timeouts | Presigned PUT a S3 con tamaño y mime máximos; registro en BD tras confirmar el objeto. |
| Coste descontrolado en F4 (jobs concurrentes, duración) | Alta | Holds acumulados por org | Máx. 1 job activo por proyecto, 3 por org; duración total ≤ 60 s por vídeo salvo plan superior; estimación obligatoria antes del hold. |
| Vídeo IA deforma geometría en giros | Media | Spike con puntuación de consistencia baja | Puerta GO/NO-GO del spike; tramos > 45° partidos; si NO-GO, F2+F3 siguen siendo el producto. |
| Solver de cotas con estancias compartiendo muros contradictorias | Media | Avisos en > 30 % de estancias en el banco offline | Orden de resolución por área descendente; muro compartido solo se mueve una vez; discrepancia > 15 % se ignora con aviso. |
| Rendimiento de captura 1080p en portátiles | Media | Frames perdidos en la grabación | Grabación no en tiempo real: renderizar frame a frame a tiempo fijo (offline render), no `captureStream`. |
| Terrazas con muros `hidden` en 3D | Baja | Suelo de terraza sin borde | Ya verificado que `hidden` omite muros/aperturas en 3D; añadir test de escena. |
| ffmpeg en Dockerfile (F4) | Baja | Build de Dokploy falla | Instalar en la imagen; probar en staging antes de cerrar F4. |

### Recommendations

1. **Contrato nuevo `PlanImportResult`** en lugar de versionar `Plano2dPayload` (evita tocar entrega, rasterizado y tests existentes).
2. **Tabla de cotas editable** en la UI de F1: la fidelidad no depende de que el modelo lea bien los números.
3. **F2 100 % cliente** (WebCodecs + mp4-muxer + presigned upload). Quita ffmpeg, Dockerfile y transcodificación de la fase.
4. **Spike GO/NO-GO al inicio de F4** con presupuesto fijo antes de construir cola, webhook y wizard.
5. **Sanitizar todo texto extraído de imágenes** antes de tocar prompts o etiquetas.
6. **Test de integración legacy→editor** en F1 (proyecto con `canvasState` previo).
7. PDF por pdf.js en cliente; si no cabe en F1, se aplaza explícitamente.

---

## Red-team (ataques sobre el diseño)

| Ataque | Vector | Estado del plan | Defensa exigida |
|---|---|---|---|
| Inyección de prompt vía plano | Texto en la imagen ("ignora instrucciones, dibuja…") pasa a `habitaciones[].nombre` → prompt de render/vídeo | No cubierto | Sanitización + nombres como datos estructurados; nunca instrucciones. |
| IDOR en recorridos/jobs | `pathId`/`jobId` de otra org en acciones de F2–F4 | Implícito | Toda acción resuelve el recurso **por org** (`withOrg`), como el resto (ver memoria anti-IDOR). |
| Spoof de webhook | POST a `api/webhooks/kie` con `status=done` y URL externa | No cubierto | Token por job en la URL; cuerpo ignorado; estado y URL del resultado se leen del proveedor; descarga solo desde dominios del proveedor. |
| Agotamiento de créditos/CPU | Lanzar N jobs o exportaciones en bucle | Parcial | Límites de concurrencia por proyecto/org; hold previo; ffmpeg con `nice` y duración máxima. |
| Subida maliciosa | "MP4"/"PNG" con contenido arbitrario a S3 | No cubierto | Presigned PUT con `Content-Type` y `Content-Length` fijados; verificación de cabecera mágica al registrar; URLs de descarga presignadas con caducidad. |
| SSRF | Imagen "redibujada" desde URL arbitraria | Cubierto (`imageBytesFromTrustedUrl`) | Mantener la misma lista blanca para resultados de vídeo del proveedor. |
| Pérdida de datos por autoridad | Importar sobre proyecto con trabajo en Editor v2 | Parcial (confirmación en UI) | Confirmación explícita + revisión previa (`EditorDocumentRevision`) para deshacer. |
| RGPD | Keyframes/vídeos son derivados de fotos del usuario | Cubierto por `SourceImage.deletedAt` | Vídeos y keyframes cuelgan del proyecto con soft-delete y retención igual que `Deliverable`. |

## Validación del plan contra el código

| Afirmación del plan | Verificado | Nota |
|---|---|---|
| `sendPlanoToEditor` escribe en canvas legacy | Sí (`withOrg(ctx).canvas.save`) | F1 debe usar `document-repo`. |
| `Wall.hidden` omite muros en 3D | Sí (`editor-document-to-scene.ts`) | Vale para terrazas/loggia. |
| `fromPlano2d` existe y crea `labels` | Sí | Extender a un adaptador nuevo, no modificar el congelado. |
| `preserveDrawingBuffer` y `frameloop` | `demand` + `preserveDrawingBuffer: true` | Grabación necesita forzar frames. |
| `DebitService` hold/settle/revert | Sí | Reutilizable por lote y por clip. |
| ffmpeg en la imagen Docker | No | Solo F4; cambio de Dockerfile. |
| Cron/jobs existentes | No hay | Cola en BD con tick + webhook; cron después si hace falta. |
| Límite Server Action 16 MB | Sí (`next.config`) | Vídeos y keyframes por presigned upload. |
| Rol `KEYFRAME`, tipo `VIDEO`, acción `video` | No existen | Migraciones Prisma en F3/F4; backup de BD antes. |

## Preguntas abiertas

1. ¿Presupuesto máximo (créditos/€) para el spike GO/NO-GO de vídeo IA en F4?
2. ¿Duración máxima de vídeo por plan de suscripción (propuesta: 60 s base)?
3. ¿PDF entra en F1 (pdf.js cliente) o se aplaza?
