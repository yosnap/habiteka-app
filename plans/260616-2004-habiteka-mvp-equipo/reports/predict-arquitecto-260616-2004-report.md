# Predict — Arquitecto/Tech Lead · Habiteka MVP

> Panel de validación del plan. Solo análisis, sin modificar plan.

## Huecos (severidad)

- **[ALTA] Contrato `plano2d` no congelado en F0.** F5 genera, F6 renderiza a Konva, F7 regenera parcial. 3 consumidores, 0 schema. → F0/F5/F6/F7.
- **[ALTA] Contrato zona/máscara ausente en F0.** F4 produce zona normalizada, F7 la consume (mask-builder). "Coordinar en impl." = acoplamiento frágil. → F0/F4/F7.
- **[ALTA] `targetRef` de elementos votables/marketplace sin contrato estable.** Id de elemento no estable entre versiones → votos/sugerencias se desincronizan. → F0/F5/F9/F10.
- **[ALTA] Payload drop marketplace→canvas no especificado.** Frontera FE↔FE no contractualizada. → F4/F10.
- **[MEDIA] `AgentState.collected` poco definido.** El guard legal depende de su forma exacta. → F0/F5/F12.
- **[MEDIA] Formato de streaming de cualificación no definido** (SSE/NDJSON, visibilidad tool-call). → F5/F6.
- **[MEDIA] `/api/health` huérfano** (F11 lo consume, F2 no lo lista). → F2/F11.
- **[BAJA] Mapeo coste-por-imagen→crédito poco explícito** (chat=tokens, imagen=por unidad). → F3/F8.

## Riesgos

- **[ALTA] F0 es SPOF temporal; "freeze" optimista.** Contratos huérfanos forzarán cambios post-freeze → roturas en cascada.
- **[ALTA] Acoplamiento F7↔F3 en `src/server/ai/image/**`.** Dos roles editando el mismo subárbol. Mover F7 a `agent/feedback/`.
- **[MEDIA] Ciclo conceptual F4↔F6.** "Utilidades read-only de F4" sin módulo aislado. Definir `canvas/render-readonly`.
- **[MEDIA] F13 fail-closed → lock-out propio** si falla firma/claves. Cache verificación + grace period.
- **[MEDIA] Prisma 7: F2 debe congelar campos de Subscription/VotingRoom/MarketplaceItem sin conocer F8/F9/F10** → migración aditiva tardía.
- **[BAJA] Estrategia de ramas no especificada** para 7 roles paralelos.

## Mejoras propuestas

1. Ampliar F0 con contratos: `plano2d-payload`, `canvas-zone` (zona+máscara), `design-element` (targetRef estable), `product-drop-payload`, `agent-stream` (deltas). Mayor ROI.
2. Mover toda F7 a `src/server/agent/feedback/`; consumir `ImageAdapter.inpaint` puro.
3. Añadir `/api/health` a F2 con contrato.
4. Definir `src/canvas/readonly/` como sub-módulo público de F4 que F6 importa.
5. Hito M1.5 "contract validation": test de integración que F2/F3/F5 compilan contra contratos congelados antes de abrir M2.
6. `pricing-table` debe cubrir coste-por-imagen, no solo tokens.

## Preguntas abiertas

1. ¿`targetRef` estable entre versiones de `Deliverable`?
2. ¿plano2d se versiona completo o por subárbol (diff/merge parcial)?
3. ¿Estrategia de ramas: worktree-por-rol o branch-por-fase?
4. ¿JWT de licencia se verifica por request o se cachea?
5. ¿F2 puede congelar campos de Subscription/VotingRoom/MarketplaceItem en M1?
