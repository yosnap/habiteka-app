---
phase: 6
title: "Panel de eficacia: calidad × coste"
status: completed
priority: P2
effort: "1d"
dependencies: [1, 5]
---

# Phase 6: Panel de eficacia

## Goal
1. Cerrar el hueco de la fase 5: las versiones nuevas creadas por iteración también se
   puntúan (evaluación posterior con `refId` = id de la versión nueva).
2. Pantalla de admin que cruza `ai_quality_evaluation` con `AiRequestCost` para responder:
   qué decide cada punto de control, cuánto cuesta un resultado aceptado, cuánto se
   desperdicia y cuánto se ahorra bloqueando antes de generar.

## Scout (hecho)
- `src/server/analytics/ai-cost-queries.ts` (agregación en memoria sobre `findMany`),
  `ai-cost-filter-params.ts` (contrato de filtros compartido página/export).
- `src/app/api/admin/ai-costs/export/route.ts`: `requireAdmin` + stream CSV con `csvRow`.
- `src/app/(admin)/analytics/ai-costs/page.tsx`: server component, formulario GET, tarjetas
  y tablas con tokens `border-line`, `bg-surface`, `rounded-card`.
- `src/components/admin/admin-nav.tsx`: lista de secciones del back-office.
- Puntos de control: previos `plan_extraction`, `editor_structure`, `change_instruction`;
  posteriores `render_result`, `memoria_result`, `plan_result`.
- Iteraciones: `runFeedback` (`feedback-orchestrator.ts`) llamado desde
  `deliverable-actions.ts` y `/api/iterations`; `createIteration` devuelve `newDeliverableId`.

## Ficheros
- `src/server/quality/iteration-result-gate.ts` (nuevo)
- `src/server/agent/feedback/feedback-orchestrator.ts`
- `src/app/(app)/projects/[id]/_actions/deliverable-actions.ts`, `src/app/api/iterations/route.ts`
- `src/server/admin/analytics/quality-queries.ts`, `quality-filter-params.ts` (nuevos)
- `src/app/(admin)/analytics/quality/page.tsx` (nuevo)
- `src/components/admin/quality-checkpoint-table.tsx`, `quality-savings-panel.tsx`,
  `quality-provider-table.tsx` (nuevos), `admin-nav.tsx`
- `src/app/api/admin/quality/export/route.ts` (nuevo)
- Tests: `tests/quality/iteration-result-gate.test.ts`, `tests/admin/quality-queries.test.ts`,
  `tests/admin/quality-export.test.ts`

## Método de cálculo (el mismo que se explica en la UI)
- **Coste por resultado aceptado**: coste de IA de las peticiones cuyo `refId` tiene una
  evaluación posterior con decisión `proceed`.
- **Gasto desperdiciado**: coste de las peticiones cuyo `refId` se evaluó `block` **o** sobre
  cuyo entregable se creó después una iteración (hubo que rehacerlo).
- **Ahorro estimado**: bloqueos de las puertas previas × coste medio de la generación que se
  evitó. El coste medio sale de las peticiones reales del rango: media por petición de
  `render3d`/`plano2d`/`memoria` para `plan_extraction` y `editor_structure`, media de
  `inpaint` para `change_instruction`. Es una estimación, no un coste observado.
- **Balance**: ahorro estimado − coste de Jev en el rango.
- Coste y evaluaciones se cruzan dentro del **mismo rango de fechas**.

## Validación
- `npx tsc --noEmit`; eslint limpio sobre lo tocado.
- Tests con datos sembrados: bandas por punto de control, no evaluadas (`failOpen=false`),
  gasto desperdiciado, ahorro estimado, export CSV con guardia de admin, y evaluación
  posterior de una iteración (se registra y no rompe si Jev falla).
- Suite completa en `habiteka_test_editor_v2`.

## Riesgo y reversión
Solo lectura en el panel; la evaluación de iteraciones traga todo error. Revertir = quitar
la ruta del admin y la llamada en `runFeedback`. Sin migración.
