# F-INT — Integración end-to-end del flujo vivo (hito de ensamblaje)

**Context Links:** [plan.md](plan.md) · agente: [phase-05](phase-05-ia-agente-state-machine.md) · chat/entregables: [phase-06](phase-06-fe-chat-entregables.md) · feedback/render: [phase-07](phase-07-feedback-render-3d.md) · créditos/pagos: [phase-08](phase-08-be-creditos-pagos.md) · QA: [phase-12](phase-12-qa-testing.md)

## Overview
- **Rol primario:** Tech Lead / Fullstack
- **Prioridad:** P1 (puerta de cierre de M2 hacia M3)
- **Estado:** 🟡 Parcial — mitad autónoma HECHA (gates RGPD/ToS/jurisdicción/cookies cableados + `cost-to-credit` con DebitService real + `wiring/README.md` con bitácora de desajustes; tests verdes). Mitad sandbox (flujo vivo + contratos contra proveedor real + job nightly) DIFERIDA: necesita dev-keys reales.
- **Depende de:** F5 (agente), F6 (UI chat/entregables), F7 (feedback/render), F8 (créditos hold/settle)
- **Paralela con:** — (es un hito de integración; corre cuando F5/F6/F7/F8 están "verdes con mocks")
- **Descripción:** Cablear el flujo **VIVO end-to-end SIN mocks**: ingesta → cualificación → entrega → feedback con **créditos reales** (`DebitService` real, no stub) y **adaptadores reales contra sandbox** de proveedores. Es el **dueño del ENSAMBLAJE** que el red team echó en falta: cada fase pasa sus tests con fixtures deterministas, pero nadie cablea el flujo real con datos vivos. F12 es transversal (estrategia de pruebas), no es owner de integración. Esta fase lo es.

## Key Insights
- **"Verde con mocks" ≠ "verde integrado".** F5 mockea `ImageAdapter`+`DebitService`; F7 mockea ambos; F6 mockea `advance`/`stream`. Al juntar aparecen **desajustes de contrato** que los mocks ocultan: forma real de `AgentStreamEvent`, formato de máscara `InpaintRequest`, mapeo `ProviderCost`→crédito. Esta fase los detecta **con dueño y antes de prod**, no tarde y sin responsable.
- **Stub eterno de `DebitService` es deuda peligrosa:** F5/F7 codifican supuestos contra el stub de F0 (orden, `insufficient_credits`, gating). Esta fase exige que el `DebitService` REAL de F8 (sobre `CreditHold` máquina de estados) sea el que corre en el flujo vivo → si F5 asumió algo que F8 invalida, se descubre aquí, no en M3.
- **Es QA-adjacent, no producción:** su entregable son tests de integración + el **cableado documentado** (wiring) del flujo. NO reescribe lógica de F5/F7/F8; si encuentra un desajuste, lo **reporta al owner** de la fase correspondiente (que lo corrige en su glob).
- **Sandbox real, fuera del CI principal:** los tests contra OpenRouter dev-key / sandbox de imagen / Polar sandbox corren en un **job aparte** (nightly/staging), no en el PR-gate (coherente con "cero llamadas reales a IA/pagos en CI").

## Requirements
**Funcionales**
- Ejercer el **flujo completo vivo**: Ingesta → Cualificación (stream real `AgentStreamEvent`) → Entrega (`hold` real → `generate` contra sandbox → `settle`/`revert` real) → Feedback (`inpaint` real con máscara `InpaintRequest` real → `hold`/`settle`).
- Usar el **`DebitService` real de F8** sobre `CreditHold` (no el stub de F0): verificar saldo, gating duro (`insufficient_credits`), idempotencyKey por operación, settle-tras-revert rechazado — en el flujo, no aislado.
- Verificar el **mapeo coste→crédito** real: `ProviderCost` reportado por el adaptador → `cost-to-credits` → débito que cuadra con el saldo.
- Validar la **forma de `AgentStreamEvent`** que F6 consume contra la que F5 emite (sin mock intermedio).
- Validar la **máscara `InpaintRequest`** que F7 construye contra lo que el `ImageAdapter` real espera.
- Tests de integración reales contra **sandbox** de OpenRouter / proveedor de imagen / Polar en **job aparte** (no en CI principal).

**No funcionales**
- El job de sandbox no bloquea PRs; detecta drift de contrato antes de prod.
- Postgres real efímero (no mock de Prisma) para el `DebitService` y la persistencia del flujo.
- Secrets de sandbox (dev-keys, Polar sandbox) solo en el entorno del job, nunca en cliente ni en logs.

## Architecture
```
tests/integration/e2e-flow/
  full-flow-vivo.test.ts          # ingesta→cualificación→entrega→feedback, DebitService real, adaptadores sandbox
  stream-event-contract.test.ts   # AgentStreamEvent emitido (F5) ↔ consumido (F6) sin mock
  inpaint-mask-contract.test.ts   # InpaintRequest construido (F7) ↔ esperado por ImageAdapter real (F3)
  cost-to-credit.test.ts          # ProviderCost real → cost-to-credits → débito cuadra con saldo
  wiring/                         # cableado documentado del flujo (composición de servicios reales)
    README.md                     # cómo se ensambla el flujo vivo + desajustes detectados y a quién se reportaron
```
**Data flow (flujo vivo):** UI/test → `advance` (F5) ⇄ `ChatVisionAdapter` sandbox (F3) → stream `AgentStreamEvent` → en Entrega `debit-service.hold` REAL (F8) sobre `CreditHold` → `ImageAdapter.generate` sandbox → `settle`/`revert` REAL → persiste `Deliverable` → Feedback: `mask-builder` (F7) → `ImageAdapter.inpaint` sandbox → `hold`/`settle` REAL → nueva versión. Todo contra **Postgres efímero**, sin mocks de la lógica propia.
**Data flow (detección de drift):** cada test de contrato compara forma real producida vs consumida; un desajuste → reporte al owner de la fase (F5/F6/F7/F8), que corrige en su glob; F-INT no edita la lógica de producción.

## Related Code Files
**A crear (owner Tech Lead / QA-adjacent):**
- `tests/integration/e2e-flow/full-flow-vivo.test.ts`, `stream-event-contract.test.ts`, `inpaint-mask-contract.test.ts`, `cost-to-credit.test.ts`.
- `tests/integration/e2e-flow/wiring/README.md` (cableado documentado + bitácora de desajustes).
**Owner globs:** `tests/integration/e2e-flow/**`.
**Lee/usa (no edita):** `src/server/agent/**` (F5/F7), `src/server/ai/**` (F3), `src/server/billing/**` (F8), `src/app/(app)/**` (F6) — todos **vía sus interfaces públicas**. Lee `src/lib/contracts/**` (F0).
**NO tocar:** ningún glob de producción. Si el ensamblaje exige un cambio de wiring no cubierto por nadie, se **documenta en `wiring/README.md` y se escala al owner** correspondiente; F-INT nunca edita `src/**` salvo cableado de wiring previamente documentado y acordado con el owner.

## Implementation Steps
1. `wiring/README.md`: documentar cómo se compone el flujo real (qué servicios reales se inyectan, en qué orden, con qué secrets de sandbox).
2. `full-flow-vivo.test.ts`: recorrer ingesta→cualificación→entrega→feedback con `DebitService` REAL (F8) + adaptadores sandbox (F3); Postgres efímero.
3. `stream-event-contract.test.ts`: capturar `AgentStreamEvent` real de F5 y verificar que F6 lo consume sin adaptación oculta.
4. `inpaint-mask-contract.test.ts`: construir máscara con `mask-builder` (F7) y verificar que el `ImageAdapter` real la acepta.
5. `cost-to-credit.test.ts`: disparar generación real, capturar `ProviderCost`, verificar que el débito resultante cuadra con el saldo.
6. Configurar el **job de sandbox** (nightly/staging, fuera del PR-gate; coordinar con F11): OpenRouter dev-key + sandbox imagen + Polar sandbox.
7. Registrar cada desajuste detectado en `wiring/README.md` y escalar al owner de la fase; re-correr hasta flujo vivo verde.

## Todo List
- [x] `wiring/README.md` (cableado de gates + bitácora de desajustes documentado)
- [ ] `full-flow-vivo` (ingesta→feedback, DebitService real + sandbox) — **diferido: necesita dev-keys (job nightly)**
- [ ] `stream-event-contract` (F5 emite ↔ F6 consume) — diferido a sandbox
- [ ] `inpaint-mask-contract` (F7 construye ↔ ImageAdapter real) — diferido a sandbox
- [x] `cost-to-credit` (OperationCost real → débito cuadra con saldo) — con DebitService REAL, Postgres real, sin sandbox
- [ ] Job de sandbox configurado (nightly/staging, fuera del PR-gate; coord. F11) — diferido
- [x] Bitácora de desajustes + gates transversales cableados (consent/ToS/jurisdicción/cookies) — verde; desajuste `settle` registrado para F8

**Mitad autónoma (sin keys) HECHA:** wiring de gates RGPD/ToS/jurisdicción/cookies con tests + cost-to-credit real. **Mitad sandbox DIFERIDA** (flujo vivo + contratos contra proveedor real) hasta tener dev-keys reales.

## Success Criteria
- Flujo completo vivo (ingesta→cualificación→entrega→feedback) verde **sin mocks** de la lógica propia, con `DebitService` REAL y adaptadores contra sandbox.
- Contratos `AgentStreamEvent`, `InpaintRequest` y `ProviderCost`→crédito verificados con producción real, no con fixtures.
- Job de sandbox operativo en nightly/staging, **fuera del CI principal**, sin bloquear PRs.
- Bitácora de desajustes detectados con su resolución (owner que corrigió), o cero desajustes.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Desajustes de contrato descubiertos en prod (verde con mocks engaña) | Alta | Crítico | Esta fase ensambla el flujo vivo antes de M3; detecta drift con dueño |
| `DebitService` stub diverge de la impl real de F8 | Media | Alto | El flujo vivo usa el `DebitService` REAL de F8; supuestos de F5/F7 se validan aquí |
| F-INT termina editando lógica de F5/F7/F8 (solape) | Media | Alto | F-INT solo posee `tests/integration/e2e-flow/**`; desajustes se reportan al owner, no se corrigen aquí |
| Job de sandbox flaky bloquea el equipo | Media | Medio | Fuera del PR-gate (nightly/staging); no bloquea merge, solo alerta de drift |
| Coste real de sandbox descontrolado | Baja | Medio | Set acotado de casos; dev-keys con límite; reutiliza el caps/allowlist de F3 |

## Security Considerations
- Secrets de sandbox (OpenRouter dev-key, Polar sandbox, claves de imagen) solo en el entorno del job; nunca en cliente ni en logs.
- Datos de prueba sin PII real; entradas anonimizadas (coherente con F14 y F-S0).
- El job de sandbox aislado del entorno de prod (cuentas/keys separadas).

## TDD / Pruebas primero
Esta fase **es** la capa de integración real (rojo→verde sobre el flujo ensamblado):
- **Flujo vivo:** `full-flow-vivo.test.ts` rojo mientras haya un desajuste de contrato entre fases; verde cuando ingesta→feedback corre con servicios reales y el débito cuadra.
- **Contrato de stream:** rojo si la forma de `AgentStreamEvent` que F5 emite no es la que F6 consume.
- **Contrato de máscara:** rojo si el `ImageAdapter` real rechaza la máscara de `mask-builder` (F7).
- **Coste→crédito:** rojo si el `ProviderCost` real no mapea al débito esperado.
- **Mock:** **ninguno de la lógica propia** — es el punto de la fase. Adaptadores y pagos corren contra **sandbox real** en job aparte; Postgres efímero. Cero mocks de `DebitService`, agente o adaptadores en este nivel.

## Next Steps
- Verde aquí = **puerta de cierre de M2 hacia M3**: el flujo core está ensamblado y validado con datos vivos.
- Alimenta a F8 (ajuste de pricing con coste real) y a F12 (estos tests entran en la suite nightly transversal).
- Coordinar con F11 el job de sandbox (secrets, schedule, separación del PR-gate).
