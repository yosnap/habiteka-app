---
phase: 2
title: "Panel de fotos por zona (reutilizable)"
status: done
priority: P1
dependencies: [1]
---

# Phase 2: Panel de fotos por zona (reutilizable)

## Overview
Un panel para subir / ver miniaturas / elegir la foto ACTIVA de la zona. Resuelve "no puedo
subir más fotos" y centraliza la subida (asistente + plano). La foto activa es la que usa el
render (Fase 1).

## Requirements
- Funcional: subir varias fotos a la zona activa; listarlas (miniaturas); marcar una como ACTIVA
  (`SourceImage.role = PRIMARY`, el resto SECONDARY).
- Funcional: el panel es reutilizable (mismo componente en el asistente y en el plano).
- No-funcional: sin romper la subida actual del chat; respeta consentimiento RGPD ya existente.

## Architecture
- Server: acción para LISTAR las SourceImage de una zona (presigned URLs) y acción para fijar la
  ACTIVA (set role PRIMARY a una, SECONDARY al resto) con scope org (anti-IDOR).
- `latestPrimaryId(pid, zoneId)` ya da la activa; falta `list(projectId, zoneId)` por zona +
  setActive.
- UI: `zone-photos-panel.tsx` (cliente) — grid de miniaturas + botón subir (reusa `ImageUpload`)
  + seleccionar activa. Se monta en el asistente (siempre visible, no solo en ingesta) y en el
  plano (panel lateral o modal).

## Related Code Files
- Create: `src/components/zones/zone-photos-panel.tsx` (o `src/components/canvas/...`).
- Modify: `src/server/db/scoped-repo.ts` (sourceImages: `listByZone`, `setActive`).
- Create: `src/app/(app)/projects/[id]/_actions/zone-photos-actions.ts` (list + setActive, scope org).
- Modify: `src/components/chat/qualification-chat.tsx` (montar el panel; no ocultar la subida al
  avanzar de fase).
- Modify: `src/components/canvas/canvas-workspace.tsx` (acceso al panel desde el plano).

## Implementation Steps (tests-first)
1. **Test (rojo):** repo `listByZone` devuelve solo las fotos de esa (proyecto, zona) y `setActive`
   deja una PRIMARY y el resto SECONDARY; valida pertenencia (test BD real, patrón orchestrator.test).
2. Implementar repo + acciones con scope org.
3. UI del panel (sin test unitario pesado; lógica pura si la hay, testeada).
4. Integrar en asistente (subida siempre disponible) y en plano.
5. **Verde:** suite verde; tsc+eslint+build limpios.

## Success Criteria
- [x] Subir varias fotos a una zona y verlas en miniaturas.
- [x] Elegir la foto activa; el render (Fase 1) usa esa.
- [x] El panel funciona desde asistente y plano.
- [x] Tests del repo verdes; suite verde.

## Risk Assessment
- Coherencia de "una sola PRIMARY": `setActive` debe ser atómico (transacción) para no dejar dos.
- Borrado de fotos: opcional en esta fase; si se añade, soft-delete como el resto.
