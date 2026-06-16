# Verificación de Versiones Actuales — Stack Habiteka (jun 2026)

> Corrige supuestos de versión de los reportes de research. Fechas/versiones verificadas vía WebSearch a 16-jun-2026.

## Tabla de versiones verificadas

| Tecnología | Versión actual (jun 2026) | Nota crítica |
|---|---|---|
| **Next.js** | **16.2.x** (16.2.9 LTS) | NO es 15. App Router maduro, RSC por defecto, Turbopack estable. |
| **React** | **19.2.x** (19.2.7, 1-jun-2026) | RSC, Actions, `use()` estables. shadcn ya soporta React 19. |
| **TypeScript** | 5.x (línea actual) | — |
| **Tailwind CSS** | **v4** | shadcn/ui built sobre Tailwind v4 (`@theme`), `tw-animate-css` reemplaza `tailwindcss-animate`. |
| **shadcn/ui** | CLI 2026 (GitHub Registries, `eject`, Rhea) | Componentes para React 19 + Tailwind v4 por defecto. |
| **Konva.js** | **10.3.0** | Canvas 2D, react-konva. ~400K dl/sem. |
| **Fabric.js** | **7.4.0** | Object model + serialización JSON nativa. ~500K dl/sem. |
| **tldraw SDK** | **5.0** (may-2026) | Infinite canvas React, licencia comercial. Display values system. |
| **Prisma ORM** | **7.x** (7.6.0, mar-2026) | ⚠️ CAMBIO MAYOR: motor Rust→TS/WASM. Bundle 14MB→1.6MB. Edge runtime nativo. |
| **Drizzle ORM** | **0.45** (may-2026) | ~7.4 KB gzip, SQL-first, ideal edge. Sigue pre-1.0. |
| **OpenRouter SDK (oficial)** | **0.13.7** (BETA) | ⚠️ Beta: breaking changes sin major bump. Recomienda pin de versión. |
| **OpenAI SDK → OpenRouter** | estable | Drop-in: apuntar `baseURL` a OpenRouter. **Preferido para producción.** |
| **Polar.sh** | pricing 2026 | ⚠️ Free Starter ahora 5% + 50¢ (antes 4% + 40¢). MoR (VAT/GST auto) vía Stripe Connect. |
| **Stripe** | API actual | Más control, requiere gestión fiscal propia (o Stripe Tax). |
| **Better Auth** | **1.6.19** (16-jun-2026) | Estable, self-host, OAuth/2FA/passkeys/RBAC. |

## Correcciones a aplicar en decisiones de stack

1. **Framework:** fijar **Next.js 16.2.x + React 19.2.x** (los reports decían Next 15 — desfasado).
2. **ORM:** Prisma 7 ya NO es el "Prisma pesado": bundle 1.6MB + edge. Empata mucho más con Drizzle.
   - **Recomendación:** Prisma 7 para MVP (mejor DX, migraciones, schema declarativo) sobre Postgres con JSONB para el estado del canvas. Drizzle como alternativa si se prioriza edge/bundle.
3. **Canvas:** decisión real entre **Konva 10.3 (react-konva)**, **Fabric 7.4** y **tldraw 5.0**. (Ver sección recomendación abajo — requiere gate del usuario, es decisión de producto.)
4. **IA / OpenRouter:** usar **OpenAI SDK oficial apuntando a OpenRouter** (estable) en vez del SDK beta de OpenRouter. Pin de versión si se usa el SDK propio.
5. **Pagos:** Polar subió precios; sigue siendo MoR (simplifica IVA UE). Stripe = más control pero gestión fiscal propia. Decisión de negocio → gate del usuario.

## Recomendación de Canvas (revisada con versiones reales)

| Lib | Pro | Contra | Encaje Habiteka |
|---|---|---|---|
| **Konva 10.3 + react-konva** | Integración React idiomática, capas, eventos por objeto, buen rendimiento | Serialización manual a JSON | ✅ Fuerte: objetos editables (muros/ventanas), drag&drop productos, selección de zonas Fase 4 |
| **Fabric 7.4** | Serialización JSON nativa→JSONB directa, object model rico | Integración React menos idiomática (imperativo) | ✅ Bueno: estado canvas→DB directo |
| **tldraw 5.0** | Infinite canvas listo, multiplayer, herramientas dibujo a mano | Opinión fuerte, licencia comercial, menos control de "entregable técnico" | ⚠️ Rápido para dibujo libre, pero menos control sobre render de plano acotado |

**Recomendación primaria:** **Konva 10.3 + react-konva** por integración React (Next 16) + control fino sobre objetos seleccionables (clave para Fase 4 feedback por zona) + drag&drop de productos del marketplace. Serializar estado a JSONB en Postgres.
**Alternativa:** Fabric 7.4 si se prioriza serialización trivial.

## Preguntas sin resolver

1. **Canvas:** ¿Konva (recomendado) o el usuario prefiere tldraw por su UX de dibujo a mano alzada lista? → gate.
2. **ORM:** ¿Prisma 7 (recomendado, mejor DX) o Drizzle (edge/bundle)? → gate ligero.
3. **Pagos:** ¿Polar (MoR, IVA auto, +caro) o Stripe (control, gestión fiscal propia)? → decisión de negocio.
4. **Render 3D fotorrealista:** OpenRouter NO genera imágenes → requiere proveedor de imagen aparte (FLUX/Nano Banana/Imagen). Confirmar si entra en MVP del plan o se difiere.
