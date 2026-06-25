# F0 — Setup del repo & Contratos transversales (ARQ / Tech Lead)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md)

## Overview
- **Rol primario:** ARQ / Tech Lead
- **Prioridad:** P1 (bloqueante de todo el equipo)
- **Estado:** Completado (PR #6)
- **Depende de:** — (raíz del grafo)
- **Paralela con:** — (debe completarse antes de F1/F2/F3/F11)
- **Descripción:** Bootstrap Next.js 16 + TS5 + Tailwind v4 + shadcn. Define la estructura de carpetas, estándares (ESLint/Prettier) y los **contratos TypeScript transversales** que todos los roles importan: `ChatVisionAdapter`, `ImageAdapter`, tipos del estado de fase del agente, interfaz del registry de add-ons y tipos de entregables. Estos contratos son el "API freeze" del equipo: BE/FE/IA programan contra ellos en paralelo.

## Key Insights
- Monolito modular Next.js full-stack; sin micro-frontends en MVP (arquitectura §1).
- Toda llamada a IA es server-side; los contratos no exponen claves ni tipos de SDK al cliente (§3).
- Dos adaptadores con interfaz común para no acoplar el agente al proveedor (§6) → interfaces deben vivir en `src/lib/contracts/**` (cliente y servidor pueden importar tipos puros).
- Registry de add-ons con metadatos + puntos de extensión (§7) → interfaz lista para terceros aunque MVP solo registre 2 add-ons de 1ª parte (YAGNI: no plugin loader real todavía).
- Stack cerrado jun 2026: NO cambiar versiones. OpenRouter usa **Chat Completions API** (no Responses API de OpenAI) → los tipos del adaptador deben modelar `messages`/`tools`/`response_format json_schema`.

## Requirements
**Funcionales**
- Proyecto Next.js 16.2 App Router arranca con `bun run dev` en el **puerto 3040** (script `dev` con `-p 3040`), página raíz placeholder.
- `src/lib/contracts/` exporta todas las interfaces transversales con barrel `index.ts`.
- `src/lib/addons/registry/` exporta interfaz `AddonDefinition`, tipos de slots y un `createAddonRegistry()` puro (sin lógica de UI).
- Path alias `@/*` configurado en tsconfig.

**No funcionales**
- TypeScript `strict: true`. Cero `any` en contratos.
- Archivos ≤200 líneas; cada contrato en su propio fichero.
- Tipos serializables (sin clases) en contratos compartidos cliente↔servidor.

## Architecture
Contratos como **capa de tipos pura** (zero runtime salvo el registry). Diseño de las interfaces clave:

- **`ChatVisionAdapter`** — abstrae Chat Completions sobre OpenRouter:
  - `chat(req: ChatRequest): Promise<ChatResult>` y `chatStream(req): AsyncIterable<ChatDelta>`.
  - `ChatRequest`: `{ messages, model, fallbackModels?, tools?, responseSchema?, temperature? }` (`fallbackModels` ≤3 → mapea a `extra_body.models` de OpenRouter).
  - `ChatResult`: `{ content, toolCalls?, structured?, usage: TokenUsage }`.
  - `MessagePart` soporta texto e imagen (`{ type:'image_url', url|base64 }`) para visión (Fase Ingesta).
- **`ImageAdapter`** — render 3D / inpainting enchufable:
  - `generate(req: ImageGenRequest): Promise<ImageResult>` · `inpaint(req: InpaintRequest): Promise<ImageResult>`.
  - `ImageResult`: `{ assetUrl, cost: ProviderCost }`.
- **Estado de fase del agente** — `AgentPhase = 'ingesta'|'cualificacion'|'entrega'|'feedback'|'addons'`; `AgentState { phase, projectId, collected, deliverables, updatedAt }` (serializable a JSONB). `collected` **bien tipado**: `Collected { objetivo?: string; estilo?: Estilo; entregables: DeliverableType[]; detected?: StructuralElements }` — es la fuente del **guard legal** (entrega bloqueada si falta `estilo` o `entregables` vacío). No usar `Record<string,unknown>`.
- **Entregables** — `DeliverableType = 'plano2d'|'render3d'|'memoria'`; `Deliverable { id, type, payload, legalSeal, version, elements? }`. `legalSeal` obligatorio (sello indeleble §4).
- **5 contratos nuevos** (un fichero por dominio):
  - **`plano2d-payload.ts`** — schema del **plano 2D estructurado** (paredes/aperturas/zonas/cotas como árbol serializable). Productor: la fase Entrega del agente; consumidores: la UI que lo renderiza en canvas y la regeneración **parcial** del feedback (debe poder localizar y reemplazar un subárbol de zona sin tocar el resto).
  - **`canvas-zone.ts`** — `CanvasZone { id, bbox|polygon (normalizado 0–1), maskRef? }`: zona normalizada + máscara para inpainting. Producido por la selección en canvas; consumido por la fase de feedback dirigido.
  - **`design-element.ts`** — `DesignElement { id, kind, targetRef }` con `targetRef` **estable entre versiones** del `Deliverable` (no cambia al regenerar una zona). Permite referenciar el mismo elemento en votación y marketplace a través de iteraciones.
  - **`product-drop-payload.ts`** — `ProductDrop { marketplaceItemId, stageX, stageY, targetRef? }`: payload del drop marketplace→canvas. Contrato **FE↔FE** (lo emite la UI de marketplace, lo consume el canvas).
  - **`agent-stream.ts`** — `AgentStreamEvent` (unión discriminada: `text-delta` | `tool-call` (con visibilidad) | `phase` | `error` | `done`): formato de deltas del **streaming del chat**. Contrato entre el orquestador (servidor) y el hook de stream (UI). Define qué tool-calls son visibles al usuario.
- **Coste→créditos** — `TokenUsage { promptTokens, completionTokens }`, `ProviderCost { amountUsd, unit }`; el mapeo a créditos lo hace BE (F8), aquí solo el tipo.
- **Servicio de débito (interfaz)** — `DebitService { hold(idempotencyKey, estimate): Hold; settle(hold, actualCost): void; revert(hold): void }`. **Contrato congelado en F0** porque el agente (Entrega) y el feedback consumen `hold/settle/revert` en M2, antes de que la implementación (BE) exista en M3. `idempotencyKey` derivado de `deliverableId+version`. En M2 se trabaja contra un **stub** que satisface la interfaz; en M3 BE provee la implementación real (ledger + lock de fila).
- **Registry** — `AddonDefinition { id, name, sdkVersion, slots: ExtensionSlot[] }`; `ExtensionSlot = 'canvas.toolbar'|'canvas.layers'|'agent.postEntrega'`.

## Related Code Files
**A crear (owner ARQ):**
- `package.json` — deps del stack cerrado + scripts (`dev/build/lint/typecheck/test`).
- `tsconfig.json` — `strict`, alias `@/*`, `moduleResolution: bundler`.
- `next.config.ts`, `.eslintrc` / `eslint.config.mjs`, `.prettierrc`, `.editorconfig`, `.gitignore`, `.env.example`.
- `src/lib/contracts/chat-vision-adapter.ts` — interfaz + tipos de chat/visión.
- `src/lib/contracts/image-adapter.ts` — interfaz + tipos de imagen/inpaint.
- `src/lib/contracts/agent-state.ts` — fases, estado, `Collected` tipado (objetivo/estilo/entregables/detected).
- `src/lib/contracts/deliverable.ts` — tipos de entregables + sello legal.
- `src/lib/contracts/credits.ts` — `TokenUsage`, `ProviderCost`.
- `src/lib/contracts/debit-service.ts` — interfaz `DebitService` (hold/settle/revert) que F5/F7 consumen en M2 vía stub; BE la implementa en M3.
- `src/lib/contracts/plano2d-payload.ts` — schema del plano 2D estructurado (consumido por entrega/render/regeneración parcial).
- `src/lib/contracts/canvas-zone.ts` — zona normalizada + máscara para inpainting.
- `src/lib/contracts/design-element.ts` — elementos con `targetRef` estable entre versiones (votación/marketplace).
- `src/lib/contracts/product-drop-payload.ts` — payload drop marketplace→canvas (contrato FE↔FE).
- `src/lib/contracts/agent-stream.ts` — eventos del streaming del chat (servidor↔hook UI).
- `src/lib/contracts/index.ts` — barrel re-export.

> **Contract freeze gate:** estos 11 contratos deben **congelarse antes de desbloquear M2** (flujo core). Cambios posteriores solo vía PR revisado por ARQ + aviso al equipo, por riesgo de rotura en cascada.
- `src/lib/addons/registry/types.ts` — `AddonDefinition`, slots.
- `src/lib/addons/registry/create-registry.ts` — fábrica pura del registry.
- `src/lib/addons/registry/index.ts` — barrel.

**NO tocar (otros owners):** `prisma/**`, `src/server/**`, `src/app/(app)/**`, `src/components/**`, `.github/**`.

## Implementation Steps
1. `bun create next-app` (o `bunx create-next-app`) con TS, App Router, Tailwind v4; fijar versiones exactas del stack en `package.json`. Commitear `bun.lock` (no usar npm/pnpm lockfiles). Definir script `"dev": "next dev -p 3040"`.
2. `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, alias `@/*`.
3. Configurar ESLint + Prettier (no estricto en formato; sí en errores de compilación).
4. Inicializar shadcn/ui (CLI) — solo config base; tokens los define UX en F1.
5. Crear `.env.example` con nombres de secrets (sin valores): `OPENROUTER_API_KEY`, `IMAGE_PROVIDER_KEY`, `POLAR_*`, `DATABASE_URL`, `BETTER_AUTH_SECRET`.
6. Escribir cada contrato en `src/lib/contracts/` (un fichero por dominio) + barrel. Incluir los 5 nuevos (`plano2d-payload`, `canvas-zone`, `design-element`, `product-drop-payload`, `agent-stream`) y el `Collected` tipado en `agent-state`.
7. Escribir `registry/types.ts` + `create-registry.ts` (Map id→def, `register`/`get`/`list`, valida `sdkVersion`).
8. `bun run typecheck` y `bun run build` deben pasar en verde con contratos importados desde un módulo de prueba.
9. Documentar en `docs/code-standards.md` la regla: comentarios explican el *porqué*, nunca el nº de fase del plan.

## Todo List
- [x] Next.js 16.2 + React 19.2 + TS5 + Tailwind v4 arrancan
- [x] tsconfig strict + alias `@/*`
- [x] ESLint/Prettier configurados
- [x] shadcn/ui base inicializado
- [x] `.env.example` con todos los nombres de secrets
- [x] 10 ficheros de contrato + barrel en `src/lib/contracts/` (incl. plano2d-payload, canvas-zone, design-element, product-drop-payload, agent-stream)
- [x] `Collected` tipado en `agent-state` (fuente del guard legal)
- [x] `targetRef` estable entre versiones en `design-element`
- [x] Registry de add-ons (types + factory + barrel)
- [x] `bun run typecheck` + `bun run build` en verde

## Success Criteria
- `bun install && bun run build` sin errores.
- Cualquier rol puede `import { ChatVisionAdapter, AgentState, Deliverable, AddonDefinition } from '@/lib/contracts'`.
- Registry registra/lista una `AddonDefinition` de ejemplo en un test unitario.
- Cero `any` en `src/lib/contracts/**`.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Contrato cambia tras empezar F2/F3 (rotura en cascada) | Media | Alto | **Contract freeze gate** antes de M2; cambios solo vía PR revisado por ARQ + aviso al equipo |
| Tipos acoplados al SDK de OpenAI filtran al cliente | Baja | Alto | Contratos no importan `openai`; tipos propios serializables |
| Next.js 16 / Tailwind v4 incompatibilidad de config | Baja | Medio | Usar plantilla oficial `create-next-app`; fijar versiones exactas |
| Registry sobre-diseñado (plugin loader prematuro) | Media | Bajo | YAGNI: solo metadatos + slots; sin carga dinámica en MVP |

## Security Considerations
- `.env.example` SIN valores reales; `.env*` en `.gitignore`.
- Contratos no exponen claves ni endpoints de proveedor; el adaptador concreto (F3) las consume server-side.
- `MessagePart` con imagen: tipar tamaño/MIME para que BE valide uploads aguas abajo.

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor):
- **Typecheck-como-test** (unit/Vitest): un módulo de prueba importa los 11 contratos desde `@/lib/contracts`; el test compila/typechea → rojo si falta un contrato o tiene `any`. Verde al escribir las interfaces.
- **Registry** (unit/Vitest): `createAddonRegistry()` registra una `AddonDefinition` de ejemplo y la recupera por id; rechaza `sdkVersion` inválido. Rojo sin factory; verde al implementarla.
- **Guard legal tipado** (unit/Vitest): un `Collected` sin `estilo` o con `entregables` vacío NO debe satisfacer el tipo de "listo para Entrega" (assertion de tipo). Verde al tipar `Collected` correctamente.
- **Mock:** nada — son tipos puros y lógica propia del registry; cero dependencias externas. **No** se mockea nada en F0.

## Next Steps
Desbloquea **F1** (UX design system), **F2** (datos+auth), **F3** (adaptadores IA) y **F11** (CI/CD) — todas dependen del repo y de los contratos congelados.
