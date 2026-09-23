---
phase: 3
title: "Asistente por intención: diseño vs convertir plano"
status: completed
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 3: Asistente por intención

## Goal
El asistente pregunta primero qué quiere hacer el usuario y adapta los pasos:
- **Crear un diseño a partir de una foto** → flujo actual (estilo → entregables → generar).
- **Convertir mi plano al editor** → subir plano → lectura + fiabilidad (fase 2) →
  con `proceed`: se aplica al editor y se ofrece seguir (diseño, vista 3D, visita);
  con `confirm`: se muestra el plano y los motivos, el usuario confirma o corrige;
  con `block`: se aplica al editor en modo corrección con los motivos y NO se ofrece generar.

## Files to Create / Modify
- Create: `src/components/chat/step-intent.tsx` (paso 0 con dos tarjetas explicadas).
- Create: `src/components/chat/step-plan-check.tsx` (vista del plano leído + % + motivos + acciones).
- Modify: `src/components/chat/wizard-steps.ts` — pasos por intención; `isStepReachable` por ruta.
- Modify: `src/components/chat/qualification-chat.tsx`, `wizard-stepper.tsx`.
- Modify: `src/server/agent/orchestrator.ts` — `collected.intent` (`design | plan`) y acción
  `import-plan` que reutiliza el pipeline del estudio + evaluación (sin duplicarlo).
- Modify: `src/lib/contracts/agent-state.ts` — `intent`.

## Implementado
- `src/components/chat/step-intent.tsx`, `step-plan-upload.tsx`, `step-plan-check.tsx`,
  `step-plan-next.tsx` y `plan-route.tsx` (estado de la ruta del plano).
- `qualification-chat.tsx` queda como enrutador por intención; el flujo de seis pasos
  se movió tal cual a `design-route.tsx`. `wizard-stepper.tsx` recibe los pasos de la
  ruta y ofrece «Cambiar lo que quiero hacer» (vuelve al paso 0).
- `wizard-steps.ts`: `DESIGN_STEPS`/`PLAN_STEPS`, `stepsFor`, `stepTitle`,
  `planStepFromState`, `editorHref` e `isStepReachable` por ruta.
- Servidor: `set-intent` en `phases/intent.ts` (cableado en el orquestador),
  `collected.intent` en el contrato, pipeline compartido extraído a
  `src/server/plan/import-plan-from-image.ts` y Server Action
  `_actions/assistant-plan-actions.ts` (`importPlanForAssistant`). Aplicar al editor
  reutiliza `applyPlanImportStudio` (lee la decisión del servidor).

## Verification
- Tests de `wizard-steps` por intención y del orquestador (`import-plan` con Jev mockeado en las tres bandas).
- `npx tsc --noEmit -p .`, eslint, suite completa.
