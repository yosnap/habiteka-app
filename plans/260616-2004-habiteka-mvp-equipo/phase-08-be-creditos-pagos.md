# F8 — Sistema de créditos & Pagos con Polar.sh (Backend)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) (§6 coste→créditos, §8 negocio) · contratos: [phase-00](phase-00-arq-setup-contratos.md) · UI: [phase-06](phase-06-fe-chat-entregables.md)

## Overview
- **Rol primario:** Backend
- **Prioridad:** P1 (monetización del MVP)
- **Estado:** Planificado
- **Depende de:** F2 (datos+auth: `User`, `Subscription`, `CreditLedger`), F6 (UI donde se inserta gating y saldo)
- **Paralela con:** F7 (feedback)
- **Descripción:** Sistema de **créditos** (`CreditLedger`: saldo + débito por entregable según **coste medido**) y **suscripciones** B2C/B2B con **Polar.sh** (Merchant of Record): checkout, webhooks, sincronización de plan/saldo y **gating** de features free vs premium.

## Key Insights
- **Polar es Merchant of Record**: maneja impuestos/checkout; nosotros sincronizamos estado vía **webhooks**. SDK `@polar-sh/sdk` + adaptador `@polar-sh/nextjs` (`Webhooks({...})`) que **valida firma** (Standard Webhooks: `webhook-id/timestamp/signature`, HMAC-SHA256) automáticamente.
- **Débito por coste medido, no estimado:** el `usage`/`ProviderCost` que devuelven F3/F5/F7 se traduce a créditos aquí (la tarifa por tipo de entregable es **decisión abierta §9.3** → tabla configurable, calibrable). El mapeo coste→crédito vive solo en F8.
- **Saldo autoritativo = `CreditBalance` (fila bloqueable), no SUM(ledger):** el débito bloquea la fila `CreditBalance` con `SELECT ... FOR UPDATE` (definido en F2) → verifica `balance ≥ coste` → decrementa → inserta en `CreditLedger` (auditoría append-only). El `SUM()` concurrente daría saldo negativo bajo réplicas; el lock de fila lo evita.
- **Hold como máquina de estados (`CreditHold`):** `hold()`/`settle()`/`revert()` operan sobre `CreditHold` (estados `PENDING→{SETTLED|REVERTED|EXPIRED}`, terminales) de F2. `idempotencyKey` **por OPERACIÓN** (no solo `deliverableId+version`): reintento de iteración, regeneración, settle-tras-revert (rechazado) y doble webhook se distinguen por clave. F8 implementa la lógica sobre el schema de F2 (no redefine tablas). El **reaper de holds huérfanos** (PENDING vencidos) lo provee F2.
- **Pricing con primer resultado GRATIS + GARANTÍA (decisión de negocio):** el modelo activa la conversión B2C reduciendo el riesgo percibido. Dos mecanismos sobre el patrón hold/settle existente, **sin tablas nuevas**: (1) **Onboarding gratis** — el **primer entregable** de una organización no consume créditos; (2) **Garantía en feedback iterativo** — las **primeras N iteraciones** de una misma zona/entregable no se cobran ("si no te gusta, no se cobra"). Mecanismo elegido: **contador de iteraciones gratis por entregable**; mientras quede cupo gratis o sea el primer entregable, el flujo hace **hold de 0** (o se revierte automáticamente al settle) → cero débito real. Se **cobra (settle real) solo cuando se agota el cupo gratis**. La decisión gratis/cobro es **server-side autoritativa** (el cliente solo refleja). `N` configurable en `SystemSetting` (calibrable sin redeploy). **Sin schema nuevo:** el contador se **deriva** de datos que F2 ya modela — "iteración nº" = `COUNT(Iteration)` del `Deliverable` (relación `Deliverable 1──n Iteration` existente); "primer entregable de la org" = ausencia de débitos previos en `CreditLedger` de esa org. F8 **no** añade columnas a `prisma/**` (propiedad de F2).
- **Idempotencia de webhooks:** Polar puede reenviar; deduplicar vía tabla **`ProcessedWebhookEvent`** (event id UNIQUE, de F2), actualizada **atómicamente** con la transacción de crédito. Toda mutación de plan/saldo idempotente.
- **Orden de ruta crítico:** el webhook necesita el **raw body** para verificar firma → route handler dedicado sin body-parsing previo (Next.js route handler lee `Request` crudo; el adaptador `@polar-sh/nextjs` lo gestiona).
- **Créditos vs suscripción:** suscripción define plan/cuota recurrente; créditos son saldo consumible por entregable. Renovación de plan puede re-emitir créditos (cycle). Gating combina ambos: feature premium requiere plan activo Y/O saldo suficiente.
- **Cap GLOBAL de plataforma (anti-sybil):** además del rate-limit/cap por user/org de F3, F8 define un **techo de gasto agregado de toda la plataforma** (suma de todo el consumo IA en una ventana). Protege contra abuso multi-cuenta (sybil: muchos registros gratis que individualmente respetan su cap pero en conjunto vacían el saldo OpenRouter). Configurable en `SystemSetting`; al superarse, corta IA para no-premium (circuit-breaker global). Complementa la **verificación anti-abuso en el registro** (email verificado / límite de cuentas por origen) que regula el ritmo al que se alcanza el cap global.
- B2B fair-code (§8): uso comercial obliga hosting oficial; F8 modela planes, F13 materializa el control de licencia.

## Requirements
**Funcionales**
- Saldo autoritativo en `CreditBalance` (fila bloqueable); `CreditLedger` registra movimientos (auditoría); exponer `getBalance(organizationId)`.
- Servicio de débito hold/settle consumido por F5/F7: `hold(orgId, cost, idempotencyKey)` → `settle(holdId)` | `revert(holdId)` sobre `CreditHold`; `hold` falla si `CreditBalance.balance` insuficiente (gating). Idempotente por `idempotencyKey` **por operación**; transiciones de estado válidas (settle-tras-revert rechazado).
- **Cap global de plataforma:** guard de gasto agregado (toda la plataforma) que corta IA a no-premium al superar el techo configurable (anti-sybil), complementario al cap por user/org de F3.
- **Free-tier / garantía:** `freeTierPolicy(orgId, deliverableId, operation)` → `{ isFree, reason }` decide server-side si la acción es gratis (primer entregable de la org **o** iteración dentro del umbral `N`). Si `isFree`, el `hold` es 0 / se revierte al settle (cero débito). Contador de iteraciones gratis por entregable; `N` y "primer entregable gratis" configurables en `SystemSetting`. Consumido por `debit-service` y expuesto a la UI de F6 (para marcar GRATIS).
- **Preview de coste:** `estimateCost(deliverableType|operation)` → créditos, alimentado por `pricing-table` (incluye coste-por-imagen) **y por `freeTierPolicy`** (devuelve coste 0 + motivo cuando aplica), consumido por la UI de F6 antes de cada acción generadora.
- Checkout Polar: crear sesión de checkout para plan/paquete de créditos; `successUrl` a la app.
- Webhooks Polar: handler que sincroniza `Subscription` y `CreditLedger` ante `subscription.created/updated/canceled`, `order.created/paid`, `checkout.*`.
- Gating: helper `canUse(userId, feature)` (free vs premium) usado por F6 (UI) y endpoints.
- Tabla de tarifas por tipo de entregable (configurable), aplicada en el mapeo coste→crédito.

**No funcionales**
- Débitos atómicos y transaccionales; saldo nunca negativo (check + lock).
- Webhooks idempotentes (dedup por event id) y verificados por firma.
- Secrets `POLAR_*` solo server-side. Archivos ≤200 líneas.
- Errores tipados (saldo insuficiente, firma inválida, evento desconocido).

## Architecture
```
src/server/billing/
  credit-ledger/
    ledger-repo.ts          # CreditBalance (saldo autoritativo, lock de fila FOR UPDATE) + CreditLedger append-only; getBalance(orgId)
    debit-service.ts        # hold()/settle()/revert() tx sobre CreditHold (máquina de estados) + check saldo + idempotencyKey por operación (gating duro)
    global-cap.ts           # techo de gasto AGREGADO de la plataforma (anti-sybil); lee SystemSetting; circuit-breaker global
    cost-to-credits.ts      # ProviderCost(tokens|imagen) → créditos vía tabla de tarifas
    pricing-table.ts        # tarifa por DeliverableType Y por operación de imagen (render/inpaint) — configurable §9.3
    free-tier-policy.ts     # primer entregable gratis + garantía N iteraciones (contador por entregable); decide isFree server-side; N en SystemSetting
    estimate-cost.ts        # estimateCost(op) → créditos (preview de F6, usa pricing-table + free-tier-policy: 0 + motivo si gratis)
  subscription/
    subscription-repo.ts    # CRUD estado de plan (sync desde webhooks)
    plan-features.ts        # mapa plan→features (free/premium)
    gating.ts               # canUse(userId, feature): plan activo y/o saldo
  polar/
    polar-client.ts         # @polar-sh/sdk con POLAR_ACCESS_TOKEN (server-only)
    checkout-service.ts     # crea checkout (plan / paquete créditos)
    webhook-handlers.ts     # handlers por evento → subscription-repo / ledger-repo (idempotente)
  errors.ts                 # BillingError (insufficient_credits|invalid_signature|unknown_event)
src/app/api/
  webhooks/polar/route.ts   # POST: Webhooks({...}) de @polar-sh/nextjs (verifica firma)
  billing/checkout/route.ts # POST: inicia checkout (auth)
```
**Data flow (débito hold/settle):** F5/F7 → `debit-service.hold(idempotencyKey)` consulta `free-tier-policy` (¿primer entregable / iteración dentro de garantía?) → si **gratis**: hold de 0 (cero débito, sin tocar saldo) y se incrementa el contador de iteraciones gratis al confirmar; si **de pago**: (tx + check + lock) ANTES de generar → generan entregable → reportan `ProviderCost`/`usage` (tokens o imagen) → `cost-to-credits` (tabla) → `settle()` confirma el cargo (o `revert()` si falló). `idempotencyKey` UNIQUE evita doble-cobro en reintentos. **Data flow (preview):** F6 → `estimate-cost` (pricing-table + free-tier-policy) → "GRATIS" (primer entregable / iteración en garantía) **o** "~N créditos, confirmar". **Data flow (pago):** UI → `billing/checkout` → `checkout-service` → Polar checkout → usuario paga → Polar envía webhook → `webhooks/polar` (firma OK) → dedup vía `ProcessedWebhookEvent` (F2, atómico con el crédito) → `webhook-handlers` → `subscription-repo` (plan) + `ledger-repo` (re-emisión de créditos). **Gating:** F6/endpoints → `gating.canUse` → plan-features + balance.

## Related Code Files
**A crear (owner BE):** todos los ficheros del árbol anterior.
**Owner globs:** `src/server/billing/**`, `src/app/api/webhooks/polar/**`, `src/app/api/billing/**`.
**Lee/usa (no edita):** `src/lib/contracts/**` (F0: `TokenUsage`, `ProviderCost`); repos/auth de F2 (`User`, esquema `Subscription`/`CreditLedger`); es **consumido por** F5/F7 (servicio `debit`) y F6 (gating/saldo).
**NO tocar:** `prisma/schema.prisma` salvo coordinación con F2 (F2 posee `prisma/**`); `src/server/agent/**` (F5/F7); `src/server/ai/**` (F3); `src/components/**`/`src/app/(app)/**` (F6 muestra el saldo, F8 solo expone el servicio).

## Implementation Steps
1. `polar/polar-client.ts`: instanciar `@polar-sh/sdk` con `POLAR_ACCESS_TOKEN` (fail-fast si falta; server-only).
2. `credit-ledger/ledger-repo.ts`: `CreditBalance` saldo autoritativo con lock de fila (`FOR UPDATE`) + `CreditLedger` append-only (auditoría); `getBalance(orgId)`; índices por `organizationId` (schema de F2).
3. `pricing-table.ts` + `cost-to-credits.ts` + `free-tier-policy.ts` + `estimate-cost.ts`: tarifa por `DeliverableType` **y** por operación de imagen (render/inpaint); conversión desde `ProviderCost`/`usage` medido; `free-tier-policy` decide gratis (primer entregable / iteración dentro de `N` por entregable, `N` en `SystemSetting`); `estimateCost` devuelve 0 + motivo si gratis, para el preview de F6.
4. `debit-service.ts`: `hold()`/`settle()`/`revert()` transaccionales sobre `CreditHold` (máquina de estados, F2) con lock de fila `CreditBalance` + `idempotencyKey` por operación; **consulta `free-tier-policy` antes del hold** → si gratis hace hold 0 / revierte al settle (cero débito) e incrementa contador; si de pago `hold` lanza `BillingError(insufficient_credits)` si no alcanza; settle-tras-revert → `BillingError(invalid_transition)`. `global-cap.ts`: guard de gasto agregado de plataforma (anti-sybil) consultado antes de aprobar `hold` de no-premium.
5. `subscription/subscription-repo.ts` + `plan-features.ts` + `gating.ts`: estado de plan, mapa de features, `canUse`.
6. `polar/checkout-service.ts` + `api/billing/checkout/route.ts`: crear checkout (plan/créditos) con `successUrl`; requiere auth (F2).
7. `polar/webhook-handlers.ts` + `api/webhooks/polar/route.ts`: `Webhooks({ onSubscriptionCreated/Updated/Canceled, onOrderCreated/Paid, ... })`; dedup vía `ProcessedWebhookEvent` (F2) en la **misma transacción** que la mutación de crédito; sync plan + re-emisión de créditos. `webhookSecret: POLAR_WEBHOOK_SECRET`.
8. `errors.ts`: tipar errores de billing.
9. Tests: débito reduce saldo y bloquea si insuficiente; **primera generación de la org no debita; iteración dentro del umbral gratis no debita; al agotar el cupo gratis sí se cobra**; webhook idempotente (reenvío no duplica); firma inválida rechazada; checkout devuelve URL; gating free vs premium. `pnpm typecheck`/`build` verdes.

## Todo List
- [ ] Cliente Polar server-only (fail-fast)
- [ ] `CreditBalance` saldo autoritativo (lock de fila `FOR UPDATE`) + `CreditLedger` append-only + `getBalance(orgId)`
- [ ] Tabla de tarifas (token + imagen) + `cost-to-credits` + `estimate-cost` (preview F6)
- [ ] `free-tier-policy` (primer entregable gratis + garantía N iteraciones, contador por entregable, `N` en `SystemSetting`)
- [ ] `debit-service` hold/settle/revert sobre `CreditHold` (máquina de estados) + idempotencyKey por operación (gating duro) + free-tier (hold 0 / revert auto)
- [ ] `global-cap` techo de gasto agregado de plataforma (anti-sybil) + circuit-breaker global
- [ ] `subscription-repo` + `plan-features` + `gating.canUse`
- [ ] Checkout (plan / paquete créditos) + route con auth
- [ ] Webhooks Polar verificados + idempotentes vía `ProcessedWebhookEvent` (atómico con crédito)
- [ ] Errores tipados de billing
- [ ] Tests de débito, idempotencia, firma, gating — verdes

## Success Criteria
- Generar un entregable debita créditos según coste **medido** (no estimado); saldo nunca negativo.
- **El primer entregable de la org NO debita; las primeras `N` iteraciones de un mismo entregable NO debitan** (hold 0 / revert auto); al agotar el cupo gratis se cobra con normalidad. La decisión gratis/cobro es server-side autoritativa.
- Saldo insuficiente bloquea la operación con `BillingError(insufficient_credits)` consumible por F5/F7.
- Webhook de Polar con firma válida sincroniza plan/saldo; reenvío del mismo evento no duplica (idempotente).
- Webhook con firma inválida → 4xx, sin mutar estado.
- `gating.canUse` distingue free vs premium y es consumible por F6 y endpoints.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Webhook reenviado duplica créditos/plan | Media | Alto | Dedup vía `ProcessedWebhookEvent` (event id UNIQUE, F2) atómico con la transacción de crédito |
| Cobro por entrega que falla / settle-tras-revert / doble webhook | Media | Alto | `CreditHold` máquina de estados (hold→settle/revert, terminales); `idempotencyKey` por operación; settle-tras-revert rechazado |
| Firma de webhook falla por body parseado | Media | Alto | Route handler dedicado con raw body (adaptador `@polar-sh/nextjs`); no middleware de parsing antes |
| Race condition en débito → saldo negativo | Media | Alto | Lock de fila `CreditBalance` (`FOR UPDATE`); check de saldo dentro de la tx; test multi-réplica (no mutex de proceso) |
| Abuso multi-cuenta (sybil) vacía saldo OpenRouter | Media | Alto | `global-cap` (techo agregado de plataforma) + verificación anti-abuso en registro; complementa cap por user/org de F3 |
| Tarifa de créditos mal calibrada (§9.3) | Media | Medio | `pricing-table` configurable; calibrar con `usage` real medido; ajustar sin redeploy si posible |
| Conflicto de schema con F2 (`Subscription`/`CreditLedger`) | Media | Alto | F2 posee `prisma/**`; F8 acuerda campos con F2 en F0/F2; no edita schema directo |
| Secrets `POLAR_*` filtrados al cliente | Baja | Crítico | Solo `src/server/billing/**`; lint contra `process.env.POLAR_*` en cliente |

## Security Considerations
- `POLAR_*` exclusivamente server-side; nunca en RSC payload, props ni respuestas a cliente.
- Verificación de firma obligatoria en cada webhook (no confiar en payload sin verificar).
- Idempotencia para evitar fraude por reenvío; loggear event id procesados.
- Débito server-side autoritativo; el cliente no decide saldo ni gating (FE solo refleja).
- Auth en `checkout` (F2): solo el usuario autenticado inicia su propio checkout.
- B2B fair-code: el plan registra tipo de uso; el control técnico de licencia (key OpenRouter como cuello de botella) se materializa en F13.

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor), integration/Vitest contra DB de test (webhook con firmador HMAC de test):
- **Webhook Polar idempotente**: el replay del mismo event id no re-emite créditos (dedup `ProcessedWebhookEvent` atómico). Rojo sin dedup.
- **Firma inválida rechazada**: payload con firma incorrecta → 4xx, sin mutar plan ni saldo. Verde al verificar firma en el handler.
- **Débito/saldo (lock de fila, multi-réplica)**: `hold` con saldo insuficiente → `BillingError(insufficient_credits)`; saldo nunca negativo bajo dos transacciones concurrentes (lock `FOR UPDATE` sobre `CreditBalance`, no mutex de proceso); `settle`/`revert` consistentes por `idempotencyKey`; **settle-tras-revert → `BillingError(invalid_transition)`**. (unit `cost-to-credits`/`pricing-table` por separado.)
- **Primer entregable + garantía gratis (no debita)**: la **primera generación** de una org no reduce saldo (hold 0); la **iteración dentro del umbral `N`** de un mismo entregable no debita; **al superar `N`** la siguiente iteración sí cobra. Saldo intacto en los casos gratis; contador por entregable correcto. (El umbral `N` se lee de `SystemSetting`.)
- **Cap global (anti-sybil)**: al superar el techo agregado de plataforma, `hold` de un no-premium → bloqueado (circuit-breaker global) SIN consumir proveedor; un premium o el reset de ventana lo libera.
- **Gating free/premium**: `canUse` distingue plan activo y/o saldo; feature premium bloqueada sin plan.
- **Mock:** se mockea la **API de Polar** (cliente SDK) y se **firma localmente** el webhook con un secret de test (cero llamadas reales a pagos en CI). NO se mockea el ledger, el debit-service ni Postgres (lógica/DB real bajo prueba).

## Next Steps
Provee el servicio `debit` que consumen **F5** (entrega) y **F7** (iteraciones), y el `gating` que **F6** usa para mostrar features free/premium y saldo. El tipo de plan B2B alimenta el control de licencia de **F13**.
