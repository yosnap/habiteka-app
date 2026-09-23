---
phase: 1
title: "Núcleo Jev: cliente, credencial en admin y registro de evaluaciones"
status: pending
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1: Núcleo Jev

## Goal
Un único servicio server-side que cualquier pipeline llama con (checkpoint, evidencia) y
que devuelve una decisión tipada, registrada en BD con su coste.

## Files to Create / Modify
- Create: `src/server/quality/jev-client.ts` — `askJev(state, questions)`: fetch a
  `/v1/systemone`, timeout, backoff en 429/529, errores normalizados como `AiError`
  (`rate_limit`, `provider_down`, `timeout`). Clave vía `resolveProviderKey('typesafe')`.
- Create: `src/server/quality/evaluate.ts` — `evaluateCheckpoint(ctx, checkpoint, evidence)`:
  construye las preguntas del checkpoint, llama a Jev, combina respuestas en `score` 0–100
  con pesos del checkpoint, aplica bandas (`proceed | confirm | block`) leídas de
  `SystemSetting` (`quality_thresholds`), aplica la política si Jev falla y registra.
- Create: `src/server/quality/checkpoints.ts` — registro tipado de checkpoints
  (id, preguntas, pesos, textos de motivo en español). Un solo sitio para añadir más.
- Create: migración Prisma `ai_quality_evaluation` (id, organizationId, userId, projectId,
  checkpoint, refId, score, decision, confidence, answers Json, evidenceHash, jevModel,
  jevInputTokens, costUsd Decimal(14,8), failOpen Boolean, createdAt; índices por
  org+createdAt, checkpoint+createdAt, refId). **Backup de la BD antes de migrar.**
- Modify: `src/server/admin/config/ai-provider-ops.ts` — `TYPESAFE_PROVIDER`, status y update.
- Create: `src/components/admin/typesafe-provider-form.tsx` (copia del patrón de
  `kie-provider-form.tsx`) y pestaña en `ai-configuration-tabs.tsx`.
- Modify: `src/server/admin/config/system-setting-ops.ts` — validación de `quality_thresholds`.

## Tasks & Steps
1. Backup de `habiteka_dev` y migración `ai_quality_evaluation`.
2. Cliente Jev con tests unitarios (fetch mockeado: 200, 422, 429→reintento, 529, timeout).
3. `evaluateCheckpoint` puro en su núcleo (combinar respuestas → score/decisión) + test.
4. Credencial `typesafe` en admin (formulario, acción, auditoría) + test de ops.
5. Ajuste `quality_thresholds` con valores por defecto y validación.

## Verification
- `npx tsc --noEmit -p .` · `npx eslint src/server/quality src/components/admin`
- `DATABASE_URL=<test> bun run scripts/test-isolated.ts run tests/quality tests/admin`
- Prueba real (manual, con clave): script en `scripts/` que evalúa una evidencia de ejemplo
  e imprime score/decisión/coste sin mostrar la clave.

## Risk / Rollback
- Clave ausente → política de fallo explícita y registro `failOpen`. Rollback: desactivar el
  proveedor `typesafe` en admin (las puertas pasan a la política configurada).
