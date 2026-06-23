---
phase: 1
title: "El render del chat respeta la foto (img2img)"
status: pending
priority: P1
dependencies: []
---

# Phase 1: El render del chat respeta la foto (img2img)

## Overview
Que el render generado desde el asistente parta de la foto subida (img2img) en vez de generarse
ciego. Resuelve la captura del usuario ("subí esto → me generó otra cosa").

## Requirements
- Funcional: `handleDeliver` pasa la foto PRIMARY de la zona como `referenceImage` al generador.
- Funcional: el prompt del render distingue interior/exterior según `ProjectZone.kind`.
- No-funcional: sin regresión del flujo del lienzo (que ya pasa referenceImage) ni del cobro
  idempotente (`deliver:project:vN`).

## Architecture
- Hoy `entrega.ts:104-111` solo añade `referenceImage` si `input.sketch`. El flujo del chat
  (`handleDeliver`) no construye `sketch`, solo resuelve `sourceImageId` (el id).
- Nueva pieza: leer los BYTES de la SourceImage desde el storage (por su `key`) y pasarlos como
  `referenceImage` en el `DeliveryInput` del chat. Reusar `getStorageAdapter` (añadir un `get`
  si no existe, o presigned + fetch en server).
- `renderPrompt`: añadir variante interior/exterior según `kind` (dato que hay que propagar a
  `DeliveryInput`, o resolver desde la zona).

## Related Code Files
- Modify: `src/server/agent/phases/entrega.ts` (renderPrompt interior/exterior; usar referenceImage
  también sin sketch).
- Modify: `src/server/agent/orchestrator.ts` (`handleDeliver`: cargar bytes de la foto de la zona
  y construir la referencia; propagar `kind`).
- Modify: `src/server/storage/s3-storage-adapter.ts` (método `get`/presigned para leer una key) si
  no existe.
- Modify: `src/app/(app)/projects/[id]/_actions/agent-actions.ts` si hay que inyectar el lector de
  imagen / kind en las deps del agente.
- Read: `src/server/agent/persistence/source-image-repo.ts`, `scoped-repo.ts` (resolver key+kind).

## Implementation Steps (tests-first)
1. **Test (rojo):** test de orquestación — con una SourceImage PRIMARY en la zona, `handleDeliver`
   invoca `image.generate` con `referenceImage` definido (hoy es undefined). Mock del image adapter
   capturando el request. Debe fallar con el código actual.
2. **Test (rojo):** `renderPrompt` con `kind='interior'` vs `kind` exterior produce prompts
   distintos (función pura, fácil de testear).
3. Implementar: lector de bytes/presigned de SourceImage por key; `handleDeliver` carga la foto
   PRIMARY de la zona y la pasa como `referenceImage`; `renderPrompt` adapta interior/exterior.
4. **Verde:** los tests pasan; el flujo del lienzo sigue intacto (su test no cambia).
5. Regresión: idempotencia de cobro sin cambios; sin doble generación.

## Success Criteria
- [ ] `handleDeliver` pasa `referenceImage` (la foto de la zona) al generador.
- [ ] `renderPrompt` distingue interior/exterior por `kind`.
- [ ] Tests nuevos verdes; suite completa verde; tsc+eslint+build limpios.
- [ ] Verificación del usuario en navegador: el render se parece a la foto subida.

## Risk Assessment
- Imagen grande en memoria del server: acotar/streamear; reusar el límite de subida.
- Boceto pobre → el modelo se desvía: mitigar con prompt ("respeta la estructura"); aceptable v1.
- Si el proveedor falla con referencia: el manejo de error del asistente (ya hecho) cubre el fallo.
