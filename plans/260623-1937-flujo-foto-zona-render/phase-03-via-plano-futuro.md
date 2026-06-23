---
phase: 3
title: "Vía plano: foto→detección→plano→render (futuro)"
status: pending
priority: P3
dependencies: [1, 2]
---

# Phase 3: Vía plano — foto→detección→plano→render (FUTURO)

## Overview
Camino alternativo para quien quiera EDITAR antes de generar: la foto se detecta, puebla el
plano 2D de la zona (persistido), y el render sale del plano. NO se implementa ahora; se
documenta para no perder la decisión.

## Requirements (cuando se aborde)
- La detección (`detectPlanFromPhoto`) PERSISTE los objetos en el `CanvasState` de la zona (hoy
  son efímeros: se pierden).
- La foto detectada queda asociada a la zona (ya se sube en F2).
- El render desde el plano ya existe (`generate-from-canvas`); reusar.

## Architecture (esbozo)
- `detectedToObjects` (bbox→StructObj) ya existe; falta guardarlos vía `saveCanvas(projectId,
  doc, zoneId)` en vez de solo ponerlos en Konva en cliente.
- Decidir UX: ¿auto-poblar el plano al subir foto, o botón "detectar en el plano"?

## Related Code Files (previsión)
- `src/app/(app)/projects/[id]/_actions/agent-actions.ts` (`detectPlanFromPhoto` → persistir).
- `src/components/canvas/detect-from-photo-dialog.tsx`.
- `src/server/actions/canvas.ts` (`saveCanvas`).

## Success Criteria (cuando se aborde)
- [ ] Detectar desde foto puebla el plano de la zona y PERSISTE.
- [ ] Render desde ese plano coherente con la foto.

## Risk Assessment
- Calidad de detección sobre foto en perspectiva es imprecisa (ya marcado BETA en el código).
- Requiere su propio predict antes de implementar.

## Nota
Fuera de alcance de esta tanda. Pendiente de priorización tras F1/F2.
