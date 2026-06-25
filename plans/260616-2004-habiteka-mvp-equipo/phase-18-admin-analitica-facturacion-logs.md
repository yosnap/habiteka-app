# F18 — Admin: Analítica, Facturación & Auditoría (Rol BE+FE)

## Context Links
- Plan general: [plan.md](plan.md) · Arquitectura: [docs/system-architecture.md](../../docs/system-architecture.md)
- Datos/`CreditLedger`: [phase-02](phase-02-be-datos-auth.md) · Usage/coste IA: [phase-03](phase-03-ia-adaptadores.md)
- Créditos/Polar: [phase-08](phase-08-be-creditos-pagos.md) · Shell/guard admin: [phase-15](phase-15-admin-shell-usuarios.md)

## Overview
- **Rol primario:** BE+FE (back-office)
- **Prioridad:** P2
- **Estado:** Completado (PR #19) — queries read-only + reembolso delegado; emisión de UsageEvent vía helper que F3/F8 cablearán
- **Depende de:** F2 (`CreditLedger`, recursos), F8 (billing/Polar: `Subscription`, pagos), F3 (usage/coste). F15 (`requireAdmin`/`writeAudit`/shell).
- **Paralela con:** F15, F16, F17
- **Descripción:** Panel admin de (a) **estadísticas de uso** (acciones, entregables generados, usuarios activos); (b) **consumo de tokens/créditos** por acción y por usuario (lee `CreditLedger`/usage); (c) **auditoría** de lo que los usuarios crean (proyectos, entregables, iteraciones) + `AuditLog` de acciones admin; (d) **vista de facturación** (admin sobre Polar de F8: suscripciones, transacciones, reembolsos).

## Key Insights
- **Lectura, no escritura, sobre datos de otras fases:** la analítica **consulta** `CreditLedger`/`CreditBalance` (F2/F8), `Deliverable`/`Iteration` (F2), `Subscription` (F8, por organización) y eventos de uso. NO modifica esos datos ni sus owners. Solo escribe en sus propios modelos de telemetría (`UsageEvent`) y lee `AuditLog`.
- **Scoping estructural también en agregados:** una vista por usuario/organización pasa por el repo `withOrg(orgContext)` de F2 (no consulta cruda saltándose el scoping). Solo las vistas **platform-wide** legítimas (el admin agrega TODAS las orgs) usan un acceso explícito de plataforma (justificado y auditado), nunca una query sin scoping "por descuido". Recordar la tenancy uniforme: todo cuelga de `organizationId` (cuenta personal = org de 1).
- **`UsageEvent` como tabla de telemetría append-only:** registrar acción IA (action, userId, orgId, tokens, costUnit, refId). Se **emite** desde el punto donde F3 reporta `usage`/`ProviderCost` o desde F8 al settle — pero el **modelo** lo declara F2 y la **escritura** la hace el productor (F3/F8), no el admin. El admin solo **agrega/lee**. Coordinar el punto de emisión con F3/F8 (evita doble fuente; DRY con `CreditLedger`).
- **Tokens vs imágenes:** F3 distingue coste por token y por imagen → la analítica debe agregarlos por unidad correcta (no sumar tokens con imágenes).
- **Facturación = espejo de Polar:** el admin **no** ejecuta cobros; muestra suscripciones/transacciones (datos sincronizados por webhooks de F8) y, para reembolsos, **delega** en la API/SDK de Polar a través de una Server Action de F8 — el admin no implementa lógica de pago propia. Reembolso = acción destructiva → `requireAdmin` + `writeAudit`.
- **Agregaciones costosas:** usar queries con índices (`createdAt`, `action`, `userId`/`orgId`); para MVP, agregación on-the-fly con rangos de fecha; materialización/caché solo si hace falta (YAGNI).
- **Privacidad:** la auditoría de "lo que crean los usuarios" muestra metadatos (tipo, fecha, propietario), no contenido sensible salvo necesidad; respetar minimización RGPD (F14).

## Requirements
**Funcionales**
- Dashboard de uso: acciones por tipo, entregables generados, usuarios activos (DAU/MAU), por rango de fecha.
- Consumo de créditos/tokens por acción y por usuario/org (lee `CreditLedger` + `UsageEvent`).
- Auditoría de creación de usuarios: listar proyectos/entregables/iteraciones por usuario (metadatos) + `AuditLog` de acciones admin.
- Facturación: listar suscripciones (estado/plan), transacciones/pagos, iniciar reembolso (vía Server Action de F8).
- Reembolso y acciones destructivas: `requireAdmin()` + `writeAudit()`.

**No funcionales**
- Solo-lectura sobre datos de F2/F8/F3 (no mutar fuera de modelos propios de telemetría).
- Queries indexadas; paginación; rangos de fecha. Archivos ≤200 líneas.

## Architecture
```
src/app/(admin)/analytics/page.tsx      # uso + consumo tokens/créditos
src/app/(admin)/analytics/audit/page.tsx# auditoría (AuditLog + creaciones de usuarios)
src/app/(admin)/billing/page.tsx        # suscripciones / transacciones / reembolsos
src/server/admin/analytics/
  usage.queries.ts          # agregaciones de UsageEvent/CreditLedger (read-only)
  audit.queries.ts          # lectura de AuditLog + recursos creados (read-only)
  billing.queries.ts        # lectura de Subscription/transacciones (read-only)
  refund.action.ts          # invoca Server Action de F8 (delegación) + writeAudit
src/app/api/admin/analytics/export/route.ts  # export CSV (opcional)
```
**Data flow:** request → `(admin)/analytics` (`requireAdmin`) → `usage.queries` agrega `UsageEvent`+`CreditLedger` por rango → RSC render. **Billing:** `billing.queries` lee `Subscription`/transacciones (sincronizadas por F8) → render; reembolso → `refund.action` → Server Action de F8 → Polar SDK → `writeAudit`. **Emisión de `UsageEvent`:** F3/F8 escriben en su flujo (coordinado), admin solo lee.

## Related Code Files
**Crear (owner F18):** todo el árbol anterior.
**Lee (no edita):** `src/server/admin/{guard,audit}.ts` (F15); tipos/queries de `CreditLedger`/`Deliverable`/`Iteration` (F2), `Subscription` (F8), usage de F3. **NO edita** `src/server/{db,billing,ai}/**` ni `prisma/**`.
**Coordinar:** punto de emisión de `UsageEvent` (lo escribe F3 al reportar coste o F8 al settle); reembolso delega en Server Action de F8 (el admin la invoca, no la implementa).
**Requiere de F2 (propuestos, NO editar `prisma/**`):** modelos `AuditLog`, `UsageEvent`.
**Sin solape:** NO toca `src/app/(app)/**` ni subrutas de F15/F16/F17. Usa `api/admin/analytics/**` (F17 usa `api/admin/media/**` — sin colisión).

## Implementation Steps
1. Proponer a F2 modelos `AuditLog(id, actorId, action, targetType, targetId, meta Json, createdAt)` y `UsageEvent(id, userId, orgId, action, unit token|image, amount, cost, refId, createdAt)` + índices (`createdAt`, `action`, `userId`).
2. Coordinar con F3/F8 el **punto de emisión** de `UsageEvent` (escrito por el productor, no por admin).
3. `usage.queries.ts`: agregaciones por acción/usuario/rango (read-only), unidad correcta (token vs imagen).
4. `audit.queries.ts`: leer `AuditLog` + listar recursos creados por usuario (metadatos).
5. `billing.queries.ts`: leer `Subscription`/transacciones sincronizadas por F8.
6. `refund.action.ts`: `requireAdmin()` → invoca Server Action de reembolso de F8 → `writeAudit()`.
7. UI dashboards (gráficas simples shadcn/tabla, rangos de fecha, paginación).
8. (Opcional) export CSV en `api/admin/analytics/export`.
9. `bun run typecheck` + `bun run build` verdes.

## Todo List
- [x] Modelos `AuditLog`/`UsageEvent` (de F2; consumidos) + índices
- [x] Punto de emisión único de `UsageEvent` (`usage-emitter`, append-only; F3/F8 lo invocan en su flujo)
- [x] Agregaciones de uso (acciones por unidad, usuarios activos)
- [x] Consumo de créditos por organización (unidad correcta: tokens e imágenes separados)
- [x] Auditoría: lectura de `AuditLog` paginada + recuento de creaciones por org (metadatos)
- [x] Facturación: suscripciones (read-only)
- [x] Reembolso delegado en la capa de facturación (`refund-service` → Polar) + `writeAudit`
- [x] Tests TDD rojo→verde (agregación token/imagen, créditos, read-only, auditoría, reembolso con mock)

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor), integration/Vitest contra Postgres efímero:
- **Agregación de uso:** sembrar `UsageEvent`/`CreditLedger` → `usage.queries` agrupa correctamente por acción y por usuario en un rango; tokens e imágenes NO se mezclan. Rojo sin query.
- **Solo-lectura:** la query de analítica no muta `CreditLedger`/`Subscription` (verificar sin escrituras).
- **Scoping en vista por org:** la vista de uso filtrada por una org pasa por `withOrg(orgContext)` y no devuelve datos de otra org; solo la vista platform-wide (acceso explícito de plataforma) agrega todas. Rojo si la query por org se salta el scoping.
- **Auditoría visible:** acciones admin previas (de F15) aparecen en `audit.queries`.
- **Reembolso delega + audita:** `refund.action` invoca la Server Action de F8 (mockeada) y escribe `AuditLog`; no implementa lógica Polar propia.
- **Guard admin:** ruta/acción de analítica/billing por no-admin → 403.
- **Mock:** se mockea Polar (vía F8) y, si aplica, el SDK. NO se mockea Prisma/Postgres.

## Success Criteria
- Dashboards muestran uso (acciones/entregables/usuarios activos) y consumo (tokens/créditos) por rango, con unidad correcta.
- Auditoría lista acciones admin y creaciones de usuarios (metadatos).
- Facturación refleja suscripciones/transacciones; reembolso funciona vía F8 y queda auditado.
- La analítica nunca muta datos de F2/F8/F3.

## Risk Assessment
| Riesgo | Prob×Imp | Mitigación |
|---|---|---|
| Doble fuente de verdad uso (UsageEvent vs CreditLedger) | Med×Med | `CreditLedger` = fuente de créditos; `UsageEvent` = telemetría; punto de emisión único coordinado con F3/F8 |
| Mezclar tokens con imágenes en agregados | Med×Med | unidad explícita en `UsageEvent`; agregaciones separadas por unidad |
| Admin muta datos de billing por error | Baja×Alto | queries read-only; reembolso solo vía Server Action de F8 (delegación) |
| Queries de agregación lentas | Med×Med | índices en `createdAt`/`action`/`userId`; paginación; rangos |
| Exposición de contenido sensible de usuarios | Med×Med | mostrar metadatos, no contenido; respetar minimización RGPD (F14) |
| Colisión `api/admin` con F17 | Baja×Med | F18 usa `api/admin/analytics/**`; F17 `api/admin/media/**` |

## Security Considerations
- Toda ruta/acción protegida por `requireAdmin()`; reembolso y destructivas auditadas.
- Read-only sobre datos de otras fases; sin secrets de Polar en cliente (reembolso ejecutado server-side por F8).
- Minimización: auditoría muestra metadatos, no contenido sensible salvo necesidad (alineado con RGPD/F14).
- Comentarios/nombres NO referencian nº de fase: explican el porqué (p.ej. "telemetría separada del ledger evita acoplar auditoría contable con métricas").

## Next Steps
- F2 incorpora `AuditLog`/`UsageEvent` + índices.
- F3/F8 emiten `UsageEvent` en su flujo; F8 expone Server Action de reembolso que F18 invoca.
- F14 (RGPD) considera la auditoría en su política de minimización/supresión.
