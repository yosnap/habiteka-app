# F5 · Foto → plano editable (puente IA→plano) · BETA

**Estado: ✅ COMPLETADA (puente, BETA); precisión de detección PENDIENTE de validar** vía prototipo
`tests/spikes/deteccion-foto.spike.ts` (claves del usuario). Rama: `feat/canvas/decoracion-materiales-luces`.
Verificado: typecheck OK, eslint OK, 7 tests del validador/mapeo. Etapa A.

## Objetivo

Al subir una foto, la IA detecta elementos + su posición (bbox) y los propone como objetos
EDITABLES del plano. El usuario acepta/corrige y luego genera (reusa CRL-4). Partir de un plano que
el usuario validó da mejor resultado que la foto cruda. El puente conecta piezas que YA existen.

## Decisiones tomadas con el usuario

- **Puente completo, marcado BETA.** Toda la cadena: detección bbox → objetos editables → generar.
  Etiqueta BETA en la UI; en testing hasta que la detección sea fiable.
- **Validación de calidad por PROTOTIPO** (claves del usuario). Métrica de salida de beta: % de
  detecciones aceptadas sin grandes correcciones. Acotar a planos en planta/cenitales; la foto en
  perspectiva entra como experimento (impreciso, ya anotado en CRL-2).

## Estado verificado (scout)

- `phases/ingesta.ts#runIngesta` hoy solo CUENTA `{walls,doors,windows,pillars}` (enteros), sin
  posiciones. F5 añade detección CON bbox + kind.
- El plano editable con `StructObj` (mover/añadir/quitar) ya existe; poblarlo reusa `store.insertObjects`.
- Generar desde el plano ya existe (CRL-4 / generateDesignFromCanvas).
- La subida de foto vive hoy en el flujo de CHAT (`image-upload.tsx`). F5 añade la entrada en el
  EDITOR del plano (botón "Detectar desde foto").

## Diseño

- **Módulo** `src/server/agent/phases/deteccion-layout.ts` (puro + IA):
  - `DETECTED_SCHEMA`: lista de `{ kind, bbox:{x,y,w,h} normalizada 0–1, confianza? }`.
  - `parseDetected(structured)`: VALIDA kind contra el catálogo (estructura+mobiliario), bbox en
    [0,1], descarta lo inválido. Frontera de confianza.
  - `detectLayout(chat, imageParts)`: pide la detección y devuelve `DetectedObject[]`.
  - `detectedToObjects(detected, stageW, stageH)`: mapea bbox normalizada → `StructObj` en px de
    stage (función pura, testeable).
- **Contrato** `src/lib/contracts/detected-object.ts`: `DetectedObject = { kind; bbox; confianza? }`.
- **Server Action** `detectPlanFromPhoto(projectId, imageParts)`: gate de consentimiento
  IMAGE_PROCESSING + ToS (como ingesta/generate), acota org, llama `detectLayout`.
- **UI** `detect-from-photo-dialog.tsx`: subir foto → ver lista detectada (marca BETA) → "Añadir al
  plano" puebla el plano con `insertObjects`. El usuario luego corrige y genera.

## TDD / Validación

- TDD piezas puras: `parseDetected` (descarta kinds fuera de catálogo, bbox fuera de [0,1]);
  `detectedToObjects` (bbox 0–1 → px; respeta tamaños relativos). NO la calidad de la detección (IA).
- Prototipo `tests/spikes/deteccion-foto.spike.ts`: corre la detección sobre imágenes de prueba y
  vuelca lo detectado para evaluar precisión (lo ejecuta el usuario con sus claves).
- Verificación: typecheck, eslint, tests focales.

## Riesgos y rollback

- **Precisión de detección (alto)** → por eso BETA + prototipo + acotar a planta/cenital. El puente
  en sí (poblar y editar) es de bajo riesgo.
- Server Action nueva (superficie): gate de consentimiento + ToS + acota org (como ingesta). Valida
  kinds y bbox (no inserta basura).
- Rollback: quitar el botón + action; el editor no cambia.

## Fuera de alcance (anotado)

- **Validación de `imageParts` en el boundary (deuda transversal):** la Server Action confía en el
  límite de tamaño del cliente (`image-upload.tsx`), igual que la ingesta. Endurecer (count≤1,
  mimeType allowlist, longitud de base64) en un sitio compartido por ingesta + detección. No es
  regresión de F5; mitigado por los gates de gasto/consentimiento.
- Foto en perspectiva con precisión alta → experimento dentro de la beta, no garantía.
- Salida de beta automática → métrica manual (% aceptado) decidida por el usuario.
- Detección de materiales/colores desde la foto → futuro (F5b/F4 lo cubren por otra vía).

## Checklist de entrega

- [x] Contrato `DetectedObject`/`NormalizedBox` + export.
- [x] `deteccion-layout.ts`: schema + `parseDetected` + `detectLayout` + `detectionPrompt`;
      `detectedToObjects` movido a `src/canvas/detected-layout.ts` (cliente-safe). Tests puros (7).
- [x] Server Action `detectPlanFromPhoto` (assertConsent IMAGE_PROCESSING + assertTosAccepted + org).
- [x] UI: `detect-from-photo-dialog.tsx` (BETA, reusa ImageUpload) → poblar plano con insertObjects.
- [ ] Prototipo `deteccion-foto.spike.ts` — LO EJECUTA EL USUARIO (precisión de detección).
- [x] Verificación: typecheck, eslint, tests focales.
