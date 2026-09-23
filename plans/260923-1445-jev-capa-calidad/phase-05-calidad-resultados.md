---
phase: 5
title: "Evaluación posterior y pre-chequeo de instrucciones"
status: completed
priority: P2
effort: "1d"
dependencies: [1]
---

# Phase 5: Calidad de resultados

## Goal
- **Antes de gastar:** Jev comprueba que una instrucción de cambio («Pedir cambios»,
  prompt libre del editor) es clara y aplicable; si no, pide reformularla sin reservar
  créditos ni llamar al modelo de imagen.
- **Después de generar:** Jev puntúa el veredicto del auditor de visión del render, la
  memoria (secciones completas, coherencia con estilo/objetivo, extensión) y el plano
  entregado; la puntuación se registra con `refId` = id del entregable y alimenta la fase 6.
- Un resultado con `block` se ve en «Diseños» y ofrece «Pedir cambios» destacado (el cupo
  gratis por entregable ya existe en `free-iterations.ts`).

## Scout (hecho)
- `assertStructuralRender` (`src/server/agent/phases/entrega.ts`) lanzaba y descartaba el
  veredicto; ahora lo devuelve y la entrega lo recoge en un mapa por id de entregable.
- `runFeedback` (`feedback-orchestrator.ts`) reserva el crédito en su primera línea: la
  puerta de la instrucción debe ir ANTES, en sus dos llamadores
  (`requestDeliverableChange` y `POST /api/iterations`).
- El plano ya se puntúa al importarlo (fase 2) y su veredicto viaja dentro del payload
  (`plano.calidad`): se reaprovecha sin volver a llamar a Jev.
- El prompt libre del editor llega a `generateDesignFromEditor`,
  `proposeNativeDesignFromEditor` y `generateConceptRenderFromEditor`, que ya pasan por
  `assertEditorQuality` (fase 4) con una única casilla de confirmación.

## Decisiones
1. **Una sola confirmación por flujo.** En «Diseños» la confirma la instrucción; en el
   editor la confirma el plano (fase 4) y la instrucción libre solo corta con `block`
   (`assertFreePromptQuality`). No se piden dos casillas por la misma generación.
2. **Evaluación posterior síncrona tras persistir**, con timeout corto (15 s) y errores
   tragados: la entrega ya está cobrada y la calidad es información, no una puerta.
3. **Un render sin auditoría de visión no se puntúa**: Jev no ve imágenes y no hay
   veredicto textual que juzgar.
4. **El plano ya evaluado no se vuelve a pagar**: se registra su veredicto de origen con
   coste 0 (`recordReusedEvaluation`).

## Ficheros
Nuevos:
- `src/server/quality/checkpoint-kit.ts` (contrato compartido, evita ciclo de módulos)
- `src/server/quality/checkpoints-instruction.ts` (`change_instruction`)
- `src/server/quality/checkpoints-results.ts` (`render_result`, `memoria_result`, `plan_result`)
- `src/server/quality/evidence/instruction-evidence.ts`
- `src/server/quality/evidence/result-evidence.ts`
- `src/server/quality/instruction-gate.ts`
- `src/server/quality/result-gate.ts`
- `src/server/quality/result-repo.ts`
- `tests/quality/instruction-gate.test.ts`, `tests/quality/change-instruction-action.test.ts`,
  `tests/quality/result-gate.test.ts`

Modificados: `checkpoints.ts`, `evaluate.ts`, `quality-verdict-card.tsx`,
`deliverable-actions.ts`/`.tsx`, `deliverables-panel.tsx`, `deliverables/page.tsx`,
`api/iterations/route.ts`, `agent-actions.ts`, `agent/orchestrator.ts`, `agent/index.ts`,
`agent/phases/entrega.ts`, `tests/agent/orchestrator.test.ts`.

## Validación
- `npx tsc --noEmit -p .` limpio y eslint sin errores sobre lo tocado.
- Suite completa en verde (240 ficheros, 1564 pruebas).
- Cubierto: las tres bandas de `change_instruction` + Jev caído (fail-closed);
  `requestDeliverableChange` bloqueado no construye dependencias ni llama a `runFeedback`;
  `confirm` sin `qualityAck` rechaza; la evaluación posterior se registra con `refId` y no
  rompe la entrega si Jev falla; una memoria con secciones ausentes puntúa bajo.

## Riesgo y reversión
- Sin migración: se reutiliza `ai_quality_evaluation` (`refId` = id del entregable).
- Reversión: quitar las llamadas a `assertInstructionQuality`/`assertFreePromptQuality` y a
  `evaluateDeliverableResults`; el resto son módulos nuevos sin efecto si nadie los invoca.
- Pendiente conocido: las iteraciones (`runFeedback`) crean un entregable nuevo que aún no
  recibe evaluación posterior; se verá sin calidad en «Diseños» hasta su primera evaluación.
