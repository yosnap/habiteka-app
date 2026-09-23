---
phase: 5
title: "Evaluación posterior y pre-chequeo de instrucciones"
status: pending
priority: P2
effort: "1d"
dependencies: [1]
---

# Phase 5: Calidad de resultados (esbozo, se detalla al empezar)

## Goal
- **Antes de gastar:** Jev comprueba que una instrucción de cambio («Pedir cambios», prompt
  libre del editor) es clara y aplicable; si no, pide reformularla sin llamar al modelo de imagen.
- **Después de generar:** Jev puntúa el veredicto del auditor de visión del render
  (`accepted`, `violations`), la memoria (secciones completas, coherencia con estilo/objetivo)
  y el plano entregado; la puntuación se guarda con el diseño y alimenta la fase 6.
- Resultados con `block` se ofrecen para regenerar sin coste o se marcan en «Diseños».

## Scout pendiente
`assertStructuralRender` en `src/server/agent/phases/entrega.ts`, `runFeedback`,
`deliverable-actions.ts`, y el prompt libre del editor v2.
