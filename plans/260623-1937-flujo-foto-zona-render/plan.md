---
title: Flujo foto → zona → render coherente
description: ''
status: in-progress
priority: P1
branch: feat/flujo-foto-zona-render
tags: []
source: brainstorm-260623-1937-flujo-foto-zona-render-coherente-report
created: '2026-06-23T19:37:00.000Z'
---

# Flujo foto → zona → render coherente

## Overview

El render generado IGNORA la foto que sube el usuario (genera una casa inventada). Además no
se pueden subir varias fotos ni por zona. Este plan conecta los 3 flujos desacoplados para que
el render RESPETE la foto (img2img), por zona, con subida reutilizable. Modo tests-first para
proteger el comportamiento actual del render/generación.

Brainstorm aprobado: `plans/reports/brainstorm-260623-1937-flujo-foto-zona-render-coherente-report.md`

## Decisiones (cerradas en el brainstorm)

- Caso de uso AMBOS (interior + exterior); se distinguen por `ProjectZone.kind` y el prompt del
  render se adapta.
- Foto→render por fases: primero img2img directo (F1), luego vía plano (F3, futuro).
- Subida = panel de fotos por zona reutilizable (F2).
- La foto activa de la zona (`SourceImage.role = PRIMARY`) es la que usa el render.

## Contexto técnico (scout verificado — no re-investigar)

- `entrega.ts:109`: `referenceImage` solo se pasa al generador si `input.sketch` (lienzo). El
  flujo del chat NO la pasa → render ciego. NanoBanana YA soporta img2img.
- `handleDeliver` (orchestrator.ts) ya resuelve `sourceImageId` por zona (`resolveSourceImageId`),
  pero solo guarda el id; faltan los BYTES/URL de la foto para pasarla como referencia.
- Storage: `getStorageAdapter` (S3/MinIO); falta una forma de leer los bytes/presigned de una
  SourceImage por su key. `SourceImage` guarda `key`, no la URL.
- `ProjectZone.kind` existe (interior/entrada/aérea/trasera…).
- `SourceImage.role` (PRIMARY/SECONDARY) ya en el esquema; `latestPrimaryId(pid, zoneId)` filtra.
- Subida hoy: `ImageUpload` solo en fase `ingesta` del chat.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [El render del chat respeta la foto (img2img)](./phase-01-render-respeta-foto.md) | Done |
| 2 | [Panel de fotos por zona (reutilizable)](./phase-02-panel-fotos-zona.md) | Done |
| 3 | [Vía plano: foto→detección→plano→render (futuro)](./phase-03-via-plano-futuro.md) | Pending (fuera de alcance) |

### Estado de implementación (260623)

F1 y F2 IMPLEMENTADAS y verificadas (tsc+eslint+build limpios, 560 tests verdes).
Pendiente: verificación manual del usuario en navegador + commit/push.

- F1: `handleDeliver` carga los bytes de la foto PRIMARY de la zona (dep
  `resolveZoneContext`, inyectada por la Server Action con scope org + storage) y los
  pasa como `referenceImage` al render (img2img). `renderPrompt` distingue
  interior/exterior por `ProjectZone.kind`. Renombrado de la dep
  `resolveSourceImageId` → `resolveZoneContext` (todos los call sites actualizados).
- F2: repo `sourceImages.listByZone`/`setActive` (transacción atómica, una sola
  PRIMARY; resto DETAIL — el enum es PRIMARY|DETAIL, no SECONDARY). Acciones
  `zone-photos-actions.ts` (list/upload/setActive con scope org anti-IDOR + consent
  RGPD). Componente reutilizable `zone-photos-panel.tsx`, montado en el asistente y en
  el plano (overlay con toggle).
- Tipo de zona: vocabulario controlado `src/lib/zone-kinds.ts` (fuente única para el
  selector y para `EXTERIOR_ZONE_KINDS`); acción `setZoneKind` + selector en el panel
  (solo zonas reales) para que la distinción interior/exterior sea alcanzable.

Code-review: DONE_WITH_CONCERNS → el único hallazgo High (kind inalcanzable) se cerró
cableando el selector de tipo de zona.

## Acceptance criteria (global)

- [ ] Al generar desde el chat, el render usa la foto PRIMARY de la zona como referencia y
      RESPETA su estructura (no inventa otra casa).
- [ ] El prompt del render se adapta a interior/exterior según `kind` de la zona.
- [ ] Se pueden subir/ver/elegir varias fotos por zona desde un panel reutilizable.
- [ ] Sin regresión del flujo del lienzo (que ya pasaba referenceImage) ni de la idempotencia
      de cobro. Suite verde; tsc+eslint+build limpios.
- [ ] Verificado en navegador (lo hace el usuario): subir foto → render que se parece a ella.

## Riesgos

- Img2img desde boceto a lápiz / foto pobre: el modelo puede desviarse; mitigar con el prompt
  (respetar estructura) y, si el proveedor lo permite, fuerza de la referencia.
- Cargar bytes de la SourceImage en el server: cuidar memoria (imágenes grandes) y no romper la
  idempotencia del cobro.
- Server de la app lo reinicia el USUARIO (regla); cambios de esquema/env → avisar.

## Fuera de alcance

- F3 (vía plano) es futuro; se documenta pero no se implementa ahora.
- Agrupar entregables por zona en el visor (mejora menor, opcional en F2).
