# F16 — Admin: Config de Modelos, Branding & Sistema (Rol BE+FE)

## Context Links
- Plan general: [plan.md](plan.md) · Arquitectura: [docs/system-architecture.md](../../docs/system-architecture.md)
- Adaptadores IA (consumidores de la config): [phase-03](phase-03-ia-adaptadores.md) (`model-routing.ts`)
- BD/auth base: [phase-02](phase-02-be-datos-auth.md) · Shell/guard admin: [phase-15](phase-15-admin-shell-usuarios.md)

## Overview
- **Rol primario:** BE+FE (back-office)
- **Prioridad:** P2
- **Estado:** Completado (PR #17) — incluye creación de productos Polar vía API desde el admin
- **Depende de:** F2 (BD, modelos nuevos), F3 (adaptadores que consumen la config de modelos), F15 (`requireAdmin`/`writeAudit`/shell)
- **Paralela con:** F15, F17, F18
- **Descripción:** Panel admin para (a) **mapeo ACCIÓN→MODELO** de OpenRouter editable en BD (acciones: `vision`, `chat`, `plano2d`, `render3d`, `inpaint`, `memoria`; cada una con modelo primario + fallbacks); (b) **branding** completo (logo, logo móvil, colores/identidad) persistido y consumido por la app; (c) **config general** del sistema (feature flags, límites). El adaptador de F3 **lee** la tabla de config en runtime (no hardcodea).

## Key Insights
- **El `model-config-loader` (lectura+caché) vive en F3** (`src/server/ai/model-config-loader.ts`), porque el adaptador IA lo consume en runtime. F3 ya migra `model-routing` a leer `ModelConfig` de BD vía ese loader, con **caché en memoria + `invalidate()`** y default seguro si la tabla está vacía. **El admin NO crea su propio loader** (DRY: una sola fuente de verdad): edita `ModelConfig` vía Prisma y llama a `model-config-loader.invalidate()` (interfaz pública de F3) tras guardar.
- **Acciones cerradas (enum):** `vision|chat|plano2d|render3d|inpaint|memoria`. Coincide con las operaciones que F3 expone. Mantener el enum sincronizado con F3 (definirlo en contrato/F0 si aplica).
- **Fallbacks ≤3** (límite OpenRouter, ver F3) → validar en escritura admin.
- **ALLOWLIST de modelos + techo de precio (un admin/bug no puede apuntar a un modelo carísimo arbitrario):** la edición de `ModelConfig` solo permite elegir modelos de una **allowlist** curada (lista de modelos permitidos por acción) y respeta un **techo de precio por acción**. La UI admin presenta un selector cerrado (no input libre de model id). F3 **valida contra la allowlist** antes de usar un modelo leído de la BD → un `primaryModel` fuera de allowlist (admin malicioso, bug de escritura, fila corrupta) se rechaza y cae al default seguro, no se factura un modelo carísimo. La allowlist y el techo de precio viven en config (no hardcode en cliente).
- **Provider/baseURL desde allowlist (fallback de gateway de F3):** `ModelConfig` puede fijar `provider`/`baseURL` por acción para el fallback de gateway de F3, pero **solo** de una allowlist de gateways permitidos — nunca un `baseURL` arbitrario (evita exfiltración de la key a un endpoint atacante).
- **Branding consumido en runtime:** la app lee `BrandSettings` (logo URL en MinIO de F17, colores) en el layout raíz. Cachear; invalidar al guardar. Las URLs de logo apuntan a assets gestionados por el media manager (F17) — el admin de branding **selecciona** un asset existente, no sube directo (DRY con F17).
- **Feature flags / límites en `SystemSetting`** (key-value tipado) → evita redeploy para togglear.
- **Parámetros anti-abuso editables en `SystemSetting` (sin redeploy):** `welcome_credits` (saldo de bienvenida finito por cuenta, consumido por F2 al registrar), `free_iterations_per_deliverable` (N iteraciones gratis por entregable, **default 3**, consumido por F8) y `accounts_per_origin_limit` (límite de cuentas por origen, anti-sybil, consumido por F8). El admin los ajusta en caliente. F2/F8 **leen el valor actual en cada decisión** (no cachean stale) → cambiar `welcome_credits` afecta a **nuevos** registros (no retroactivo); cambiar `free_iterations_per_deliverable` afecta a la siguiente evaluación de iteración. Validación en escritura: enteros ≥0 (techo razonable para evitar fijar millones por error).
- **Validación de color/contraste:** los colores de marca deben pasar validación básica (hex válido); el contraste AA es responsabilidad de UX, no bloqueante aquí.

## Requirements
**Funcionales**
- CRUD de `ModelConfig`: por cada acción, editar `primaryModel` + `fallbacks[]` (≤3) + `enabled` (+ opcional `provider`/`baseURL`). La UI ofrece un **selector cerrado** desde la **allowlist** de modelos/gateways permitidos; rechaza model id/baseURL fuera de allowlist o por encima del **techo de precio** por acción.
- F3 lee `ModelConfig` en runtime (loader con caché) **y valida contra la allowlist** antes de usar el modelo; admin invalida caché al guardar.
- CRUD de `BrandSettings`: logo, logoMobile (refs a `MediaAsset` de F17), paleta de colores, nombre de marca.
- CRUD de `SystemSetting`: feature flags + límites (key, value tipado, enabled). Incluye los parámetros anti-abuso editables: `welcome_credits` (consumido por F2), `free_iterations_per_deliverable` (default 3, consumido por F8), `accounts_per_origin_limit` (consumido por F8). Validar enteros ≥0 con techo razonable; seed con defaults. El editor expone estos campos con descripción de su efecto (afecta a nuevos registros / a la próxima iteración).
- Toda mutación: `requireAdmin()` + `writeAudit()`.

**No funcionales**
- Lectura de config en runtime O(1) (caché en memoria); sin golpear BD por request.
- Archivos ≤200 líneas. Sin claves/secrets de proveedores aquí (solo nombres de modelo, no API keys).

## Architecture
```
src/app/(admin)/config/
  models/page.tsx            # editor acción→modelo+fallbacks
  branding/page.tsx          # brand kit (selecciona assets de F17)
  system/page.tsx            # feature flags / límites
src/server/admin/config/
  models.actions.ts          # CRUD ModelConfig vía Prisma + llama model-config-loader.invalidate() de F3
  system.actions.ts          # CRUD SystemSetting
  # NOTA: el model-config-loader (lectura+caché) lo posee F3 (src/server/ai/), no se duplica aquí
src/server/admin/branding/
  branding.actions.ts        # CRUD BrandSettings + invalidar caché
  branding-loader.ts         # lee BrandSettings + caché (consumido por layout raíz)
```
**Data flow (config modelos):** admin edita → `models.actions` valida (fallbacks≤3, modelo no vacío) → Prisma `ModelConfig` → llama `model-config-loader.invalidate()` (de F3). **Runtime IA:** F3 `model-routing` → `model-config-loader.get(action)` → `{primary, fallbacks, enabled}` (caché; default si vacío) → llamada OpenRouter. **Branding:** layout raíz → `branding-loader.get()` → logo/colores (caché) → render.

## Related Code Files
**Crear (owner F16):** todo el árbol anterior.
**Lee (no edita):** `src/server/admin/{guard,audit}.ts` (F15), tipos Prisma `ModelConfig`/`BrandSettings`/`SystemSetting`, `MediaAsset` (F17, solo refs).
**Coordinar con F3 (NO editar `src/server/ai/**`):** el `model-config-loader` (lectura+caché+`invalidate()`) lo posee F3 en `src/server/ai/`. F16 lo **consume**: tras escribir `ModelConfig`, llama `model-config-loader.invalidate()`. F16 no duplica el loader (DRY). El enum de acciones (`vision|chat|plano2d|render3d|inpaint|memoria`) se mantiene sincronizado con F3/F2.
**Requiere de F2 (propuestos, NO editar `prisma/**`):** modelos `ModelConfig`, `BrandSettings`, `SystemSetting`.
**Sin solape:** NO toca `src/app/(app)/**`, `src/server/{ai,agent,db,billing}/**`, ni subrutas de F15/F17/F18.

## Implementation Steps
1. Proponer a F2 los modelos `ModelConfig(action UNIQUE, primaryModel, fallbacks Json/String[], enabled)`, `BrandSettings(singleton: brandName, logoAssetId, logoMobileAssetId, colors Json)`, `SystemSetting(key UNIQUE, value Json, enabled)` + seed de defaults.
2. (El `model-config-loader` con caché + `invalidate()` + fallback a defaults lo implementa F3 en `src/server/ai/`; F16 solo lo consume.)
3. `models.actions.ts`: CRUD `ModelConfig` vía Prisma con validación (fallbacks≤3, action en enum, **modelo/provider en allowlist, precio ≤ techo por acción**) + `model-config-loader.invalidate()` (de F3) + `writeAudit()`. La allowlist y el techo viven en config (p.ej. `SystemSetting`/constante de servidor compartida), no en el cliente.
4. Coordinar con F3: confirmar que `model-routing.ts` consume el loader en vez de constante **y valida contra la allowlist** antes de usar el modelo (un model id fuera de allowlist cae al default). (F3 edita su propio fichero.)
5. `branding-loader.ts` + `branding.actions.ts`: CRUD `BrandSettings`, selección de assets de F17, caché+invalidación.
6. `system.actions.ts`: CRUD `SystemSetting` (flags/límites), incluidos `welcome_credits`, `free_iterations_per_deliverable` (default 3) y `accounts_per_origin_limit` (validación entero ≥0 + techo; `writeAudit()`). F2/F8 leen el valor actual en cada decisión (no se cachea stale) → cambio en caliente sin redeploy.
7. UI editores (shadcn forms) en `(admin)/config/**`.
8. `bun run typecheck` + `bun run build` verdes.

## Todo List
- [x] Modelos `ModelConfig`/`BrandSettings`/`SystemSetting` (de F2; consumidos) + seed
- [x] Editor acción→modelo+fallbacks (validación ≤3 + allowlist + techo de precio) que escribe `ModelConfig` + llama `invalidateModelConfig()` de F3
- [x] F3 consume el loader (ya existente de F3; invalidate cableado desde el admin)
- [x] `branding-loader` (caché+invalidate) + ops de brand kit (validación hex)
- [x] Editor de feature flags / límites + parámetros anti-abuso (`welcome_credits`, `free_iterations_per_deliverable`, `accounts_per_origin_limit`, `global_spend_cap_usd`) con validación entero ≥0 + techo
- [x] `writeAudit()` en toda mutación de config
- [x] **Creación de productos Polar vía API (`polar.products.create`) desde el admin** + id guardado en `SystemSetting`
- [x] Tests TDD rojo→verde (validación, invalidación de caché, hex, producto Polar con mock)

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor):
- **Acción de config invalida la caché (integration, Postgres efímero):** `models.actions.update('chat', ...)` persiste en `ModelConfig` y llama `model-config-loader.invalidate()`; la siguiente lectura del loader (de F3) devuelve el nuevo valor. (El test del loader en sí — caché + fallback a defaults — vive en F3.) Rojo sin la action.
- **Validación fallbacks≤3:** guardar 4 fallbacks → rechaza. Verde con validación.
- **Allowlist + techo de precio:** guardar un `primaryModel`/`provider` fuera de la allowlist → rechaza; guardar un modelo por encima del techo de precio de la acción → rechaza. (Complementa el test en F3 de que `model-routing` valida la allowlist antes de usar el modelo.)
- **Branding consumido:** `branding-loader.get()` devuelve logo/colores guardados; cambio en admin se refleja tras invalidar.
- **`welcome_credits` afecta a nuevos registros (integration):** `system.actions.update('welcome_credits', X)` persiste; un registro **posterior** acredita X al `CreditBalance` (F2 lee el valor actual); un registro anterior no cambia (no retroactivo). Rojo si F2 hardcodea el valor.
- **`free_iterations_per_deliverable` leído en caliente (integration):** cambiar N en `SystemSetting` → la siguiente evaluación de `freeIterationsRemaining` (F8) usa el nuevo N sin redeploy (el contador de iteraciones lee el valor actual). Rojo si se cachea stale.
- **Validación entero ≥0:** guardar valor negativo o no-entero en `welcome_credits`/`free_iterations_per_deliverable`/`accounts_per_origin_limit` → rechaza. Verde con la validación.
- **Auditoría:** cambiar config escribe `AuditLog`.
- **Mock:** se mockea OpenRouter (F3 ya lo mockea). NO se mockea Prisma/Postgres.

## Success Criteria
- Admin cambia el modelo de una acción y F3 usa el nuevo en la siguiente llamada (sin redeploy).
- Branding (logo/colores) editable y reflejado en la app tras guardar.
- Feature flags togglean comportamiento sin redeploy.
- `welcome_credits`/`free_iterations_per_deliverable`/`accounts_per_origin_limit` editables; cambiar `welcome_credits` afecta a nuevos registros y `free_iterations_per_deliverable` a la siguiente iteración, sin redeploy.
- Tabla vacía no rompe (defaults). Toda mutación auditada.

## Risk Assessment
| Riesgo | Prob×Imp | Mitigación |
|---|---|---|
| F3 sigue hardcodeando y se ignora la config | Med×Alto | El loader (propiedad de F3) es la única fuente; coordinar con F3; test (en F3) que verifica `model-routing` consume el loader |
| Config corrupta deja la IA sin modelo válido | Med×Alto | Validación en escritura + fallback a defaults + `enabled` por acción |
| Admin/bug apunta a un modelo carísimo arbitrario | Med×Alto | Allowlist de modelos + techo de precio por acción; selector cerrado en UI; F3 valida contra allowlist antes de usar (fuera de allowlist → default) |
| `baseURL`/provider arbitrario filtra la key a endpoint atacante | Baja×Crítico | provider/baseURL solo de allowlist de gateways; nunca input libre |
| Caché obsoleta tras editar | Med×Med | `invalidate()` en cada action de escritura; TTL corto de respaldo |
| Branding referencia asset borrado en F17 | Baja×Med | FK/validación de existencia del `MediaAsset` al guardar |
| Doble fuente de verdad (código vs BD) | Med×Med | Seed inicial = defaults; BD es la fuente; defaults solo fallback |

## Security Considerations
- Toda ruta/acción protegida por `requireAdmin()`; mutaciones auditadas.
- **NO** almacenar API keys de proveedores aquí (solo nombres de modelo); las keys siguen en `process.env` server-side (F3).
- Validar entrada (hex de color, enum de acción) para evitar inyección en config consumida por la app.
- Comentarios/nombres NO referencian nº de fase: explican el porqué (p.ej. "config en BD evita redeploy para cambiar de modelo").

## Next Steps
- F3 migra `model-routing` a consumir el loader.
- F17 provee los assets de logo que branding referencia.
- F2 incorpora `ModelConfig`/`BrandSettings`/`SystemSetting`.
