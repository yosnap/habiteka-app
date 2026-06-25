# F12 — Estrategia TDD transversal (Rol QA / Testing)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) · contratos: [phase-00](phase-00-arq-setup-contratos.md) · adaptadores IA: [phase-03](phase-03-ia-adaptadores.md) · agente: [phase-05](phase-05-ia-agente-state-machine.md) · pagos: [phase-08](phase-08-be-creditos-pagos.md) · CI: [phase-11](phase-11-ops-cicd-despliegue.md)

## Overview
- **Rol primario:** QA / Testing
- **Prioridad:** P1 (calidad transversal del MVP)
- **Estado:** Planificado
- **Depende de:** todas (cada fase aporta su superficie). Arranca con F0 (config de runners) y acompaña cada fase escribiendo sus tests ANTES del código.
- **Paralela con:** continua.
- **Descripción:** Estrategia **test-first** del plan: cada fase (F0–F14) define y escribe sus pruebas en su propia sección "TDD / Pruebas primero" ANTES del código (rojo→verde→refactor). F12 **no** lista los tests fase a fase (eso vive en cada fase); F12 fija la **infraestructura transversal**: pirámide, convención de nombres y ubicación, política de mocks de servicios externos, gates de cobertura por hito, Definition of Done test-first y cableado con CI (F11). QA **solo lee** código de producción; **nunca lo edita** — posee únicamente `tests/**`, `playwright/**`, `*.test.ts` y la config de runners.

## Key Insights
- **Test-first es la regla, no la excepción:** ninguna fase se considera hecha sin sus tests rojos→verdes. Las secciones "TDD / Pruebas primero" de cada fase son el contrato de QA con cada owner; F12 las habilita técnicamente.
- **Las interfaces de F0 son el punto de inyección:** BE/IA programan contra `ChatVisionAdapter`/`ImageAdapter` → QA inyecta dobles deterministas (structured outputs, `assetUrl`, `usage`/`ProviderCost` controlados) → testea state machine y créditos **sin red**.
- **NUNCA red a IA/pagos en CI:** OpenRouter, proveedor de imagen y Polar se mockean con fixtures deterministas; cero secrets reales. Tests con proveedor real = manuales/nightly opt-in, fuera del pipeline bloqueante.
- **DB de test real, no mock de Prisma:** integration/e2e contra Postgres efímero → valida migraciones (coherente con F11). Datos sembrados/limpiados por test.
- **Invariantes legales como test:** `legalSeal` presente y visible en cada entregable (y en el **export**, no solo DOM); disclaimer de Ingesta presente; consentimiento RGPD antes de tratar imagen.
- **Solo lectura de producción:** QA no parchea código de app; reporta fallos al owner de la fase.

## Pirámide de tests
- **Unit (Vitest, mayoría):** lógica pura sin DB ni red — `cost-to-credits`, `gating`, registry de add-ons, `deltas` votación, `affiliate-url` allowlist, ledger, serialización canvas, sanitizer de imagen, routing/fallback IA, verificación de licencia, `pii-scrub`.
- **Integration (Vitest + Postgres efímero, capa media):** route handlers + DB — auth/scoping, debit hold/settle, webhooks Polar (firma+idempotencia), agente 5 fases con IA mock, feedback por zona, voting, marketplace, supresión RGPD.
- **E2E (Playwright, pocos y críticos):** ingesta→entrega (IA mock), checkout (Polar mock), crear sala y votar.
- **Visual regression (Playwright):** solo vistas estables — entregables, canvas snapshot, sello legal en export.
- **A11y (Playwright + axe):** chat, stepper, panel entregables, sala de votación, disclaimers.

## Convención de nombres y ubicación
- **Nombres descriptivos de escenario, SIN nº de fase ni códigos de finding.** Ej.: `reassign-credit-hold-is-idempotent`, `delivery-blocked-without-style`, `webhook-replay-does-not-duplicate`, `inpaint-modifies-only-selected-zone`, `seal-present-in-export`.
- **Ubicación:**
  - Unit: colocalizados `*.test.ts` junto al módulo, o en `tests/unit/<dominio>/`.
  - Integration: `tests/integration/<dominio>/*.test.ts`.
  - E2E/visual/a11y: `playwright/{e2e,visual,a11y}/*.spec.ts`.
  - Fixtures/helpers: `tests/fixtures/**`, `tests/helpers/**`.

## Política de mocks de servicios externos
- **Se mockea (fixtures deterministas, cero red en CI):** OpenRouter (chat/visión/structured), proveedor de imagen (`generate`/`inpaint`), Polar (cliente SDK + webhook firmado localmente), OAuth de Google, object storage (RGPD), reloj (TTL/exp licencia).
- **NO se mockea (lógica propia bajo prueba):** state machine, guards, ledger/debit-service, sanitizer, routing/fallback, mask-builder/partial-plan-editor, verificación de licencia y su grace, cascada de supresión.
- **NO se mockea Prisma/Postgres:** integration/e2e usan DB real efímera.
- **Regla anti-fuga:** un test que importe el adaptador real de IA/Polar debe romper el job (lint/guard); CI sin `OPENROUTER_API_KEY`/`POLAR_*`.

## Gates de cobertura por hito
> Cobertura como puerta, no como fetiche: alta en lógica de negocio, pragmática en UI.

| Hito | Alcance | Gate |
|---|---|---|
| **M1 — Contratos + datos** | F0 (contratos/registry), F2 (datos/auth), F3 (adaptadores) | Unit verde de contratos/registry; integration de hold/settle/IDOR/dedup webhook contra DB; adaptadores con IA mock. Cobertura lógica ≥80% en F2/F3 puros. |
| **M2 — Flujo core** | F4 canvas, F5 agente, F6 UI, F7 feedback | Integration agente: 5 transiciones + guard legal + hold/revert con IA mock. E2E ingesta→entrega. Invariante `legalSeal` en export. Cobertura ≥80% en orquestador/feedback. |
| **M3 — Negocio + add-ons** | F8 billing, F9 voting, F10 marketplace, F13 licencia | Webhook firma/idempotencia; gating; no doble-voto; allowlist afiliación; fail-closed+grace de licencia. Cobertura ≥80% en billing/licencia. |
| **M4 — Hardening + cumplimiento** | F12 barrido + F14 RGPD | Suite completa verde; visual sin diffs no aprobados; axe sin violaciones críticas; supresión cero huérfanos; consentimiento bloqueante. Gate de release. |

## Definition of Done (test-first)
Una fase está "hecha" solo si:
1. Sus tests de la sección "TDD / Pruebas primero" se escribieron **antes** del código y pasaron de rojo a verde.
2. Unit + integration de la fase verdes en CI **sin red** a IA/Polar.
3. Invariantes legales aplicables (sello/disclaimer/consentimiento) cubiertas por test.
4. `bun run typecheck` + `bun run build` verdes.
5. Cobertura del hito cumplida para la lógica de negocio de la fase.

## Architecture
```
vitest.config.ts             # raíz: test.projects = [unit, integration]
tests/
  fixtures/
    ai-adapters/             # fakes de ChatVisionAdapter / ImageAdapter + respuestas deterministas
    polar/                   # payloads de webhook + firmador HMAC de test
    seed/                    # datos sembrados para integration/e2e
  unit/                      # lógica pura por dominio
  integration/               # route handlers + DB de test
  helpers/
    test-db.ts               # arranque/limpieza Postgres efímero
    sign-polar-webhook.ts    # firma válida con secret de test (Standard Webhooks)
    mock-ai.ts               # inyecta dobles de adaptadores IA
playwright/
  e2e/                       # ingesta→entrega, checkout, votar
  visual/                    # entregables, canvas, sello legal
  a11y/                      # axe sobre vistas clave
  playwright.config.ts
```
**Data flow (test del agente):** test → `mock-ai` inyecta fakes (fixtures) → orquestador F5 → asevera transiciones/guards/persistencia sin red. **Webhook:** `sign-polar-webhook` firma payload con secret de test → POST a `/api/webhooks/polar` → asevera sync + idempotencia contra DB. **E2E:** Playwright contra app levantada con adaptadores mock y DB efímera.

## Related Code Files
**A crear (owner QA):** todo bajo `tests/**`, `playwright/**`, `vitest.config.ts`, y los `*.test.ts`.
**Owner globs:** `tests/**`, `playwright/**`, `**/*.test.ts`, `vitest.config.ts`.
**Lee (NO edita) — producción:** `src/**`, `prisma/**`, `src/lib/contracts/**`, route handlers de todas las fases. QA importa interfaces/funciones para testear; **no modifica** código de app.
**NO tocar (editar):** ningún fichero de producción. La config de CI que ejecuta los tests la posee F11 (OPS); QA aporta los comandos/targets, OPS los cablea en `.github/**`.

## Implementation Steps
1. `vitest.config.ts`: `test.projects` `unit` (rápido, sin DB) e `integration` (con `test-db`). Coverage report.
2. `tests/fixtures/ai-adapters/` + `helpers/mock-ai.ts`: dobles deterministas de `ChatVisionAdapter`/`ImageAdapter`.
3. `helpers/test-db.ts`: Postgres efímero + migraciones + seed/limpieza por test.
4. `helpers/sign-polar-webhook.ts`: firma Standard Webhooks (id/timestamp/HMAC) con secret de test.
5. Establecer la convención de nombres/ubicación y el guard anti-fuga (lint que rompe si un test importa el adaptador real).
6. Acompañar cada fase: revisar que sus tests "TDD / Pruebas primero" existen y pasan rojo→verde antes del merge.
7. `playwright.config.ts` + e2e/visual/a11y críticos (mock IA/Polar, DB efímera).
8. Exponer scripts (`test`, `test:integration`, `test:e2e`, `test:visual`, `test:a11y`) para que F11 los cablee como gates de CI sin red a IA/Polar.
9. Ejecutar el **barrido final** (M4) y validar gates de cobertura por hito antes del release.

## Todo List
- [ ] `vitest.config.ts` con `test.projects` unit/integration + coverage
- [ ] Fakes de adaptadores IA + fixtures deterministas (sin red)
- [ ] `test-db` Postgres efímero + migraciones
- [ ] `sign-polar-webhook` (firma de test)
- [ ] Convención de nombres/ubicación + guard anti-fuga de adaptador real
- [ ] Acompañamiento test-first por fase (rojo→verde antes de código)
- [ ] e2e/visual/a11y Playwright críticos
- [ ] Scripts de test expuestos a F11 (sin secrets IA/Polar reales)
- [ ] Gates de cobertura por hito (M1–M4) verificados
- [ ] Barrido final M4 verde

## Success Criteria
- Cada fase entrega con sus tests escritos ANTES del código y en verde (DoD test-first).
- `bun test` (unit) verde y determinista **sin red**; integration verde contra Postgres efímero con migraciones reales.
- Test del agente cubre las 5 transiciones y guards usando **solo mocks** de adaptadores IA — cero llamadas reales en CI.
- Webhook Polar: firma válida sincroniza, inválida rechaza, reenvío no duplica.
- E2E cubre ingesta→entrega, checkout y votar; visual sin diffs no aprobados; axe sin violaciones críticas.
- Invariantes: `legalSeal` presente en cada entregable y en el export; disclaimer de Ingesta presente; consentimiento RGPD bloqueante.
- Gates de cobertura por hito (M1–M4) cumplidos en lógica de negocio.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Tests llaman a OpenRouter/imagen/Polar reales en CI (coste/flaky/secrets) | Media | Alto | Inyección obligatoria de fakes vía interfaces F0; guard que falla si un test importa el adaptador real; CI sin secrets de IA/Polar |
| Código escrito antes que el test (se rompe el TDD) | Media | Alto | DoD test-first; revisión de QA por fase: el test rojo debe preceder al código; PR sin test de la fase no mergea |
| Firma de webhook mal generada → falsos fallos | Media | Medio | `sign-polar-webhook` replica Standard Webhooks; fixture verificada contra el adaptador |
| Visual regression flaky (fuentes/render canvas) | Media | Medio | Fijar viewport/fuentes/seed; tolerancia de diff; baseline versionado y revisado |
| E2E lentos bloquean el pipeline | Media | Medio | Separar unit (bloqueante) de e2e/visual (job aparte, paralelizado); pocos e2e críticos |
| QA edita producción por accidente (rompe ownership) | Baja | Alto | QA solo posee `tests/**`/`playwright/**`/config runners; reporta fallos al owner, no parchea |
| DB de test no aislada entre tests | Media | Medio | `test-db` limpia/seed por test; transacción o schema por worker |

## Security Considerations
- **Cero secrets reales en CI de tests:** secrets de IA/Polar sintéticos; `BETTER_AUTH_SECRET`/firmas de test locales.
- Verificar que ningún test loggea ni filtra claves; fixtures sin credenciales reales.
- Tests de invariantes de seguridad: sin claves IA en payload cliente (F6); `affiliateUrl` allowlist (F10); auth en mutaciones (F2/F9); fail-closed de licencia (F13); consentimiento/minimización (F14).
- DB de test efímera, nunca apuntar a Postgres de producción.

## Next Steps
F11 (OPS) cablea los scripts en `.github/**` como gates (unit bloqueante; e2e/visual en job aparte). QA acompaña cada fase test-first y ejecuta el **barrido final** (M4) antes del release. Cualquier fallo se reporta al owner de la fase, que corrige; QA no parchea producción.
