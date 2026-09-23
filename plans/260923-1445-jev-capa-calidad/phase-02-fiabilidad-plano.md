---
phase: 2
title: "Puerta de fiabilidad del plano (estudio y asistente)"
status: completed
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Fiabilidad del plano

## Goal
Tras leer un plano de una imagen, Jev da el % de fiabilidad de la copia y ese % decide
si el plano se usa tal cual, se confirma o se manda al editor a corregir.

## Evidencia (JSON que se envía a Jev; nunca la imagen)
Construida por una función pura `buildPlanEvidence(raw, detected, result)`:
- muros medidos en píxeles (`detected.walls.length`) vs muros leídos por el modelo (`raw.muros.length`) y ratio;
- estancias leídas vs zonas resultantes cerradas; zonas sin geometría;
- cotas escritas vs medidas calculadas por estancia (desviación % máx y media);
- `escalaEstimada`, número y tipo de `warnings` y `corrections` de `buildPlanImport`;
- huecos sin muro, muros degenerados, solapes.

Preguntas (inglés, atómicas): `score` de fidelidad global (5 niveles), `noul` "all rooms
closed", `noul` "dimensions consistent with written values", `noul` "wall count consistent
between pixel and model reading", `choice` de causa principal si falla (escala, muros, huecos, estancias).

## Files to Create / Modify
- Create: `src/server/quality/evidence/plan-evidence.ts` (+ test con fixtures de planos reales de `tests/`).
- Modify: `src/server/quality/checkpoints.ts` — checkpoint `plan_extraction`.
- Modify: `src/app/(app)/projects/[id]/_actions/studio-actions.ts` — `importPlanFromImage`
  devuelve `quality` (score, decisión, motivos) y lo guarda en el estado del estudio.
- Modify: pantalla del estudio (`src/app/(app)/projects/[id]/plano/page.tsx` y su componente) —
  indicador de fiabilidad con motivos; con `block`, «Aplicar» lleva al editor en modo corrección.
- Modify: `src/server/agent/phases/entrega.ts` / `src/server/agent/index.ts` — `planoFromImage`
  evalúa y solo entrega el plano como fiel con `proceed`; si no, `aproximado` + motivo.

## Verification
- Tests de `plan-evidence` (plano nítido → evidencia coherente; foto → ratio de muros bajo).
- Test de la acción con Jev mockeado: `block` no aplica al editor automáticamente.
- Prueba manual con 3 imágenes: plano nítido, plano borroso, foto de salón.
