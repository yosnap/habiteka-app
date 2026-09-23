---
phase: 6
title: "Panel de eficacia: calidad × coste"
status: pending
priority: P2
effort: "1d"
dependencies: [1, 5]
---

# Phase 6: Panel de eficacia (esbozo, se detalla al empezar)

## Goal
Pantalla de admin que cruza `ai_quality_evaluation` con `AiRequestCost` por `refId`/proyecto:
tasa de `proceed/confirm/block` por checkpoint, coste medio por resultado aceptado, gasto
desperdiciado (generaciones con score bajo o revertidas), comparativa por proveedor/modelo,
coste de Jev frente a tokens ahorrados por bloqueos, y exportación CSV como la de costes.

## Scout pendiente
`src/server/analytics/*`, `src/components/admin/ai-cost-*.tsx`, `/api/admin/ai-costs/export`.
