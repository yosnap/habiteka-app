# F10 — Add-on Marketplace (Frontend + Backend)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) (§7 marketplace) · registry/contratos: [phase-00](phase-00-arq-setup-contratos.md) · modelos: [phase-02](phase-02-be-datos-auth.md) (`MarketplaceItem` en `prisma/schema/addons.prisma`) · canvas: [phase-04](phase-04-fe-canvas-konva.md) · panel entregables: [phase-06](phase-06-fe-chat-entregables.md)

## Overview
- **Rol primario:** FE + BE
- **Prioridad:** P2 (add-on de negocio/monetización por afiliación, no bloquea flujo core)
- **Estado:** Completado (PR #21)
- **Depende de:** F4 (canvas: destino del drag&drop), F6 (panel de entregables: punto de entrada al add-on). Usa modelos de F2 y registry/slots de F0.
- **Paralela con:** F9 (votación) — globs disjuntos.
- **Descripción:** Add-on de **marketplace** registrado contra la interfaz del registry de add-ons (F0). **Catálogo curado propio** (productos seed en DB, modelo `MarketplaceItem`), **drag&drop al canvas**, **links de afiliación reales** (Ikea / Amazon Associates) y **tracking de afiliación** (clics). Se enchufa en slots `canvas.toolbar` (paleta de productos) y `agent.postEntrega` (sugerencias por diseño aprobado).

## Key Insights
- **SIN integración de API real de catálogo en MVP:** Amazon PA-API y feeds Ikea son inestables/restringidos → catálogo es **seed estático en DB** (decisión arquitectura §7). **Sync automático = post-MVP**; no construir cliente de feed ahora (YAGNI).
- **Implementado como add-on:** registra `AddonDefinition` (`id:"marketplace"`, `slots:['canvas.toolbar','agent.postEntrega']`) vía `createAddonRegistry()` de F0. Mismas interfaces que un tercero.
- **Drag&drop reusa el canvas de F4:** el add-on aporta la paleta y emite el payload del producto arrastrado como `ProductDrop` (contrato `product-drop-payload` congelado en F0); el **drop y la colocación** los maneja la API del canvas de F4, que consume ese mismo contrato. El add-on **no** reimplementa el canvas. Este contrato compartido elimina la frontera FE↔FE frágil.
- **Links de afiliación reales:** cada `MarketplaceItem` lleva `affiliateUrl` con el tag de afiliación correcto (Ikea/Amazon Associates). Compliance: divulgación de afiliación visible (disclosure) junto al catálogo.
- **Tracking = registro de clic propio, no pixel de terceros:** un endpoint registra el clic (`itemId`, `userId?`, `projectId?`, timestamp) antes de redirigir a `affiliateUrl`. Métrica interna; sin PII innecesaria.
- **MarketplaceItem ligado a Deliverable (opcional):** el catálogo se puede filtrar por el diseño aprobado (sugerencias), pero el catálogo base es global y curado. La extracción de "qué sugerir" la aporta F5/F7 (elementos del diseño); el add-on solo mapea a productos del seed.
- **Sin claves IA/billing aquí:** afiliación no consume créditos; arrastrar un producto al canvas no factura.

## Requirements
**Funcionales**
- Catálogo curado navegable (paleta en `canvas.toolbar`): listar `MarketplaceItem` del seed con imagen, nombre, vendor, precio orientativo.
- Drag&drop de un producto del catálogo al canvas (F4 coloca el ítem; el add-on aporta el payload).
- Link de afiliación por producto: clic → registra tracking → redirige a `affiliateUrl` (Ikea/Amazon).
- Disclosure de afiliación visible junto al catálogo (compliance Associates/Ikea).
- (Opcional MVP) Sugerencias: filtrar catálogo por elementos del diseño aprobado.
- Seed reproducible de productos (`prisma/seed/marketplace.ts`).

**No funcionales**
- Catálogo seed estático; NO llamadas a PA-API/feeds en runtime MVP.
- Componentes/handlers ≤200 líneas; tipos desde `@/lib/contracts` y Prisma.
- `affiliateUrl` validada (allowlist de dominios Ikea/Amazon) — no URLs arbitrarias.
- Tracking de clic idempotente-tolerante (no bloquea la redirección si falla el log).

## Architecture
```
src/addons/marketplace/
  marketplace-addon.ts       # AddonDefinition + registro en el registry (F0)
  server/
    catalog-repo.ts          # lectura de MarketplaceItem (seed); filtros opcionales
    affiliate-tracking.ts    # registra clic (item,user?,project?) antes de redirigir
    affiliate-url.ts         # valida/normaliza affiliateUrl (allowlist Ikea/Amazon)
  ui/
    catalog-palette.tsx      # paleta de productos (slot canvas.toolbar)
    product-card.tsx         # tarjeta: imagen, vendor, precio, draggable
    use-product-drag.ts      # hook drag → payload para el canvas (F4 hace el drop)
    affiliate-disclosure.tsx # texto de divulgación de afiliación (compliance)
src/app/api/marketplace/
  catalog/route.ts           # GET catálogo (filtros opcionales por diseño)
  affiliate/route.ts         # GET ?itemId= → registra clic → 302 a affiliateUrl
prisma/seed/
  marketplace.ts             # seed de MarketplaceItem (catálogo curado)
```
**Data flow (catálogo):** `catalog-palette` monta en `canvas.toolbar` → `GET /api/marketplace/catalog` → `catalog-repo` lee seed → tarjetas. **Data flow (drag&drop):** `use-product-drag` produce payload del producto → API de canvas de F4 coloca el ítem en el lienzo (el add-on no edita `src/canvas/**`). **Data flow (afiliación):** clic en producto → `GET /api/marketplace/affiliate?itemId=` → `affiliate-tracking` registra clic → `affiliate-url` valida → `302` a `affiliateUrl`.

## Related Code Files
**A crear (owner F10):** todos los ficheros del árbol anterior + `prisma/seed/marketplace.ts`.
**Owner globs:** `src/addons/marketplace/**`, `src/app/api/marketplace/**`, `prisma/seed/marketplace.ts`.
**Lee/usa (no edita):** `src/lib/contracts/**` y `src/lib/addons/registry/**` (F0); modelo Prisma `MarketplaceItem` (F2, declarado en `prisma/schema/addons.prisma`); API/utilidades de `src/canvas/**` (F4: el canvas recibe el drop); `src/server/auth/**` (F2: sesión opcional para tracking); elementos del diseño de F5/F7 vía `Deliverable.payload` (sugerencias opcionales).
**NO tocar:** `prisma/schema/**` (owner F2 — solo se posee el seed `prisma/seed/marketplace.ts`, no el schema); `src/canvas/**` (F4); `src/server/agent/**`, `src/server/ai/**` (F5/F3); `src/components/**` y `src/app/(app)/projects/**` (F4/F6); `src/addons/voting/**`, `src/app/api/voting/**`, `src/app/(app)/voting/**` (F9).

## Implementation Steps
1. `marketplace-addon.ts`: declarar `AddonDefinition` y registrarlo en el registry de F0 (slots `canvas.toolbar`, `agent.postEntrega`).
2. `prisma/seed/marketplace.ts`: seed curado de `MarketplaceItem` (nombre, vendor, imagen, precio orientativo, `affiliateUrl` con tag correcto).
3. `server/catalog-repo.ts`: lectura del seed; filtros opcionales por elementos del diseño.
4. `server/affiliate-url.ts`: allowlist de dominios (Ikea/Amazon Associates); valida/normaliza el tag de afiliación.
5. `server/affiliate-tracking.ts`: registrar clic (item, user?, project?, ts); tolerante a fallo (no bloquea redirección).
6. Route handlers: `catalog/route.ts` (GET catálogo) y `affiliate/route.ts` (GET → track → 302).
7. `ui/catalog-palette.tsx` + `product-card.tsx`: paleta en `canvas.toolbar`; tarjetas draggable.
8. `ui/use-product-drag.ts`: produce payload de producto; el drop lo resuelve la API del canvas de F4.
9. `ui/affiliate-disclosure.tsx`: texto de divulgación visible junto al catálogo.
10. Tests (delegados a F12): catálogo lee seed; `affiliate` registra clic y redirige a URL allowlisted; URL no-allowlisted rechazada. `bun run typecheck`/`bun run build` verdes.

## Todo List
- [x] `AddonDefinition` de marketplace registrado en el registry (slots canvas.toolbar/agent.postEntrega)
- [x] Catálogo curado seed estático en código (`catalog-seed.ts`; sin feeds externos en runtime)
- [x] `catalog-repo` (lectura seed + filtro por categorías)
- [x] `affiliate-url` con allowlist de dominios (Amazon/Ikea, https, anti sufijo-falso)
- [x] `affiliate-tracking` (registro de clic vía telemetría, tolerante a fallo)
- [x] Route handlers catálogo + afiliación (valida allowlist → track → 302)
- [x] Paleta de catálogo + tarjetas draggable
- [x] Hook drag → emite/lee `ProductDrop` (contrato F0; el drop lo hace F4)
- [x] Disclosure de afiliación visible (no ocultable)
- [x] Tests verdes (allowlist anti open-redirect, catálogo/filtro, ProductDrop, registro add-on)

## Success Criteria
- El catálogo curado se lista desde el seed (sin llamadas a PA-API/feeds en runtime).
- Un producto se arrastra del catálogo al canvas (colocado por la API de F4).
- Clic en producto registra tracking y redirige a un `affiliateUrl` válido (Ikea/Amazon) con disclosure visible.
- URL de afiliación fuera de la allowlist es rechazada.
- Add-on registrado vía la interfaz del registry de F0.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Querer integrar PA-API/feed Ikea en MVP (scope creep) | Media | Medio | Decisión firme §7: solo seed estático; sync automático = post-MVP, fuera de scope |
| `affiliateUrl` abierta → open-redirect / tag manipulado | Media | Alto | Allowlist de dominios en `affiliate-url`; tag fijado server-side, no desde input cliente |
| Incumplimiento de disclosure Associates/Ikea | Media | Alto | `affiliate-disclosure` siempre visible junto al catálogo; revisión legal del texto |
| Drag&drop choca con la API del canvas de F4 | Media | Alto | El add-on solo emite payload; el drop/colocación es responsabilidad de F4 (contrato acordado); no edita `src/canvas/**` |
| Seed desactualizado (precios/enlaces rotos) | Media | Bajo | Catálogo curado pequeño; revisión manual; sync automático post-MVP |
| Solape de modelo con F2 | Baja | Alto | F2 posee `prisma/schema/**`; F10 solo posee `prisma/seed/marketplace.ts` y consume `MarketplaceItem` |

## Security Considerations
- `affiliateUrl` siempre validada contra allowlist (Ikea/Amazon); el tag de afiliación se fija server-side — el cliente nunca lo provee.
- Tracking sin PII innecesaria; `userId` opcional, anonimizable; el log no bloquea ni filtra a terceros más allá de la redirección.
- Disclosure de afiliación obligatoria (compliance) y no ocultable por props.
- Sin claves IA/billing en el add-on; arrastrar productos no consume créditos.

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor), integration/Vitest contra DB de test:
- **Catálogo lee seed**: `catalog-repo` devuelve `MarketplaceItem` del seed sin llamadas a feeds externos. Rojo sin seed/repo.
- **affiliateUrl allowlist**: una URL fuera de la allowlist (Ikea/Amazon) es rechazada; una válida pasa con el tag fijado server-side. Verde con `affiliate-url`.
- **Afiliación track→302**: `GET /affiliate?itemId=` registra el clic y redirige 302 a la `affiliateUrl`; el fallo del log no bloquea la redirección. Rojo sin el handler.
- **Drop emite ProductDrop**: el hook de drag produce el `ProductDrop` (contrato F0) que el canvas de F4 consume (no edita `src/canvas/**`).
- **Mock:** ninguna IA/pago. No se llama a PA-API/feeds (seed estático). DB y validación de URL propias NO se mockean.

## Next Steps
Add-on autónomo: no desbloquea fases posteriores. Junto con F9 valida que el registry/slots de F0 soportan add-ons de 1ª parte (y futuros de terceros). Sync automático de catálogo (PA-API/feeds Ikea) queda como trabajo post-MVP reemplazando el seed por `catalog-repo` con fuente externa, sin tocar UI/tracking.
