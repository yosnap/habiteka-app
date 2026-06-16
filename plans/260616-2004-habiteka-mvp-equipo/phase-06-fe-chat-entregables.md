# F6 — UI Chat de cualificación + Panel de entregables (Frontend)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) · [canva-flow.md](../../docs/canva-flow.md) · contratos: [phase-00](phase-00-arq-setup-contratos.md) · agente: [phase-05](phase-05-ia-agente-state-machine.md)

## Overview
- **Rol primario:** Frontend
- **Prioridad:** P1
- **Estado:** Planificado
- **Depende de:** F4 (canvas Konva), F5 (orquestador del agente)
- **Paralela con:** F8 (créditos+pagos)
- **Descripción:** UI del chat de cualificación con streaming, panel de entregables (plano 2D renderizado en canvas, render 3D, memoria de materiales), sello legal **visible** y navegación entre las 5 fases. Integra con el canvas (F4) y el agente (F5) sin reimplementar lógica de IA ni de orquestación.

## Key Insights
- FE solo **presenta y dispara**: invoca Server Actions/route handlers de F5 (`advance`, stream de cualificación); no contiene prompts, tools ni claves.
- **Streaming en cliente:** consumir el stream del chat (`chatStream` expuesto vía route handler de F5) con `ReadableStream`/`AsyncIterable`; render incremental de tokens. React 19 + RSC para el shell; el chat es Client Component.
- El plano 2D llega como **JSON estructurado** (de F5/F0 `Deliverable.payload` tipo `plano2d`): el FE lo **renderiza en canvas** reusando la capa Konva de F4 (capa read-only de entregable), no genera la geometría.
- Render 3D y memoria son assets/texto del `Deliverable`: el 3D es imagen (`assetUrl`), la memoria es texto estructurado.
- **Sello legal visible**: el `Deliverable.legalSeal` se muestra en el margen del visor (no editable, no ocultable). Disclaimer de Ingesta visible en la pantalla de carga.
- **Sello en el export, no solo en el DOM:** un overlay DOM **no** aparece en `stage.toDataURL()` ni en el export PDF → el sello del plano2d/render debe dibujarse **dentro del Stage de Konva** (capa de sello) o aplicarse **server-side** antes de servir el asset. El overlay DOM es solo refuerzo visual, no la fuente del sello exportado.
- **Preview de coste en créditos (con estado GRATIS visible):** antes de toda acción generadora (entrega, iteración) la UI muestra el coste alimentado por `gating`/pricing/`estimateCost` de F8. Cuando F8 reporta gratis (primer entregable, o iteración dentro de la garantía de N) la UI lo marca **claramente como GRATIS** ("Tu primer diseño es gratis" / "Esta mejora no consume créditos — garantía") en vez de "~N créditos". Si es de pago, muestra "~N créditos, confirmar". La fuente de la decisión es server-side (F8); el FE solo refleja `isFree`+motivo.
- **Hooks de streaming sin `useEffect` directo:** consumir `AgentStreamEvent` (F0) vía `useSyncExternalStore`/refs/event-driven (regla no-useEffect del proyecto), no con `useEffect` de suscripción manual.
- Navegación de fases refleja `AgentState.phase`; estados deshabilitados según guards (p.ej. Entrega bloqueada hasta validar estilo+tipo → CTA guía al chat).
- **Sin solape con F4:** F4 posee el canvas core (`src/canvas/**`) y la vista de edición; F6 posee las vistas de chat y entregables y una capa de presentación de plano2d que *consume* utilidades de F4.

## Requirements
**Funcionales**
- Chat de cualificación: input, historial de mensajes, indicador de streaming, opciones rápidas de estilo (`modernista|nordico|industrial|clasico|retro`) y selección de entregables.
- Panel de entregables con 3 visores: plano2d (en canvas Konva), render3d (imagen), memoria (texto).
- Sello legal renderizado de forma persistente sobre/junto a cada entregable; disclaimer en carga. Para el plano2d/render: sello **dentro del Stage Konva** o server-side (sobrevive a `toDataURL`/export PDF).
- **Preview de coste en créditos** antes de cada acción generadora; consume `gating`/pricing/`estimateCost` de F8 y **distingue visualmente GRATIS** (primer entregable / iteración en garantía) de "~N créditos, confirmar".
- Navegación de fases (stepper) sincronizada con `AgentState.phase`; transiciones disparan `advance`.
- Estados de carga/error/empty por fase; reintento ante fallo de `advance`.

**No funcionales**
- Componentes ≤200 líneas; composición sobre componentes grandes (split por visor).
- Accesible (roles ARIA en chat/stepper); responsive.
- Sin lógica de negocio de IA/orquestación en cliente; tipos importados de `@/lib/contracts`.
- shadcn/ui + tokens de F1; sin estilos ad-hoc duplicados (DRY).

## Architecture
```
src/components/chat/
  qualification-chat.tsx     # contenedor del chat (Client Component)
  message-list.tsx           # historial + render de streaming incremental
  message-input.tsx          # input + envío → advance()
  style-quick-picks.tsx      # chips de estilo (enum)
  deliverable-picker.tsx     # selección de entregables (enum[])
  cost-preview.tsx           # GRATIS (primer entregable / garantía) o "~N créditos, confirmar" antes de acción generadora (estimateCost/gating F8)
  use-agent-stream.ts        # hook: consume AgentStreamEvent (F0) vía useSyncExternalStore/refs (sin useEffect)
src/components/deliverables/
  deliverables-panel.tsx     # tabs/layout de los 3 visores
  plan2d-viewer.tsx          # renderiza Deliverable(plano2d) en canvas (usa capa F4 read-only)
  render3d-viewer.tsx        # muestra assetUrl del render 3D
  materials-memo.tsx         # memoria de materiales (texto estructurado)
  legal-seal.tsx             # sello visible en DOM (refuerzo); el export lo lleva la capa Konva/server-side
  konva-seal-layer.ts        # capa de sello DENTRO del Stage → presente en toDataURL/export PDF
  phase-stepper.tsx          # navegación de las 5 fases (refleja AgentState.phase)
src/app/(app)/projects/[id]/
  chat/page.tsx              # vista chat de cualificación
  deliverables/page.tsx      # vista panel de entregables
  _actions/agent-actions.ts  # Server Actions thin que llaman a F5 (advance)
```
**Data flow:** usuario escribe → `message-input` → `advance()` (Server Action F5) → stream de deltas vía `use-agent-stream` → `message-list` render incremental. Al alcanzar fase Entrega: `AgentState.deliverables` → `deliverables-panel` → cada visor consume su `Deliverable`. `plano2d.payload` → `plan2d-viewer` → capa Konva read-only (utilidades de F4) → canvas. `legalSeal` → `legal-seal` siempre visible.

## Related Code Files
**A crear (owner FE):** todos los ficheros del árbol anterior.
**Owner globs:** `src/components/chat/**`, `src/components/deliverables/**`, `src/app/(app)/projects/[id]/chat/**`, `src/app/(app)/projects/[id]/deliverables/**`, `src/app/(app)/projects/[id]/_actions/agent-actions.ts`.
**Lee/usa (no edita):** `src/canvas/**` (F4: utilidades de render Konva — importa, no modifica); `src/lib/contracts/**` (F0); endpoints/Server Actions de F5.
**NO tocar:** `src/canvas/**` (impl F4), `src/server/**` (F2/F5/F8), `src/components/canvas-core` o equivalente de F4, `src/app/(app)/projects/[id]/canvas/**` (F4).

## Implementation Steps
1. `use-agent-stream.ts`: hook que consume el stream (`AgentStreamEvent` de F0, route handler de F5) vía `useSyncExternalStore`/refs/event-driven (sin `useEffect` de suscripción); acumula deltas (texto + tool-calls visibles según el contrato).
2. `message-list.tsx` + `message-input.tsx`: historial accesible + envío que invoca `agent-actions.advance`.
3. `style-quick-picks.tsx` + `deliverable-picker.tsx`: chips/enum mapeados a los valores cerrados; al elegir → mensaje al agente.
4. `qualification-chat.tsx`: compone lo anterior; maneja loading/error/empty.
5. `konva-seal-layer.ts` + `legal-seal.tsx`: sello dibujado **dentro del Stage** (capa Konva → aparece en `toDataURL`/PDF) + refuerzo DOM no ocultable. Disclaimer en carga (Ingesta) reusando el texto de contratos/F5.
6. `cost-preview.tsx`: antes de disparar entrega/iteración, consultar `estimateCost`/`gating` de F8; si `isFree` mostrar **GRATIS** + motivo (primer diseño / garantía), si no "~N créditos, confirmar"; solo al confirmar se invoca `advance`.
8. `plan2d-viewer.tsx`: mapear `Plano2dPayload` (F0) a primitivas Konva usando utilidades read-only de F4.
9. `render3d-viewer.tsx` + `materials-memo.tsx`: visores de imagen y texto.
10. `deliverables-panel.tsx` + `phase-stepper.tsx`: layout de tabs + stepper sincronizado con `AgentState.phase`; deshabilitar Entrega hasta guard OK (CTA al chat).
11. `_actions/agent-actions.ts`: Server Actions thin → F5 (`advance`); sin lógica de negocio.
12. Tests de componente (estados, sello en export `toDataURL`, preview de coste, stepper, hook sin useEffect) + `pnpm typecheck`/`build` verdes.

## Todo List
- [ ] Hook de streaming (`AgentStreamEvent`) sin useEffect (useSyncExternalStore/refs)
- [ ] Chat (lista + input + quick-picks de estilo + picker de entregables)
- [ ] Preview de coste antes de acción generadora: marca GRATIS (primer entregable / garantía) vs "~N créditos" (gating/estimateCost F8)
- [ ] Sello legal: capa Konva dentro del Stage (export) + refuerzo DOM + disclaimer de carga
- [ ] Visor plano2d en canvas (capa read-only F4)
- [ ] Visor render3d + memoria de materiales
- [ ] Panel de entregables + stepper de fases sincronizado
- [ ] Server Actions thin a F5
- [ ] Tests de componente + typecheck/build verdes

## Success Criteria
- El chat muestra tokens en streaming y consolida estilo+entregables vía las quick-picks/picker.
- El panel renderiza los 3 entregables; el plano2d se dibuja en canvas desde su JSON.
- `legalSeal` visible y no ocultable en cada entregable; disclaimer presente en Ingesta.
- El stepper bloquea Entrega hasta que F5 reporta guard legal cumplido.
- Cero lógica de IA/claves en cliente; tipos solo desde `@/lib/contracts`.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Solape de ficheros con F4 (canvas) | Media | Alto | F6 importa utilidades read-only de F4; nunca edita `src/canvas/**`; ownership por globs disjuntos |
| Stream se corta / parsing de deltas frágil | Media | Medio | Hook con buffering + estados de error y reintento; fallback a respuesta no-stream |
| JSON de plano2d no mapea limpio a Konva | Media | Alto | Contrato `plano2d.payload` cerrado en F0; visor tolera campos opcionales; mostrar error claro |
| Sello ausente en export (overlay DOM no se captura en `toDataURL`/PDF) | Media | Crítico | Sello dibujado dentro del Stage Konva (`konva-seal-layer`) o aplicado server-side; test que verifica su presencia en el export, no solo en el DOM |
| Hook de stream con `useEffect` (viola regla del proyecto) | Media | Medio | `useSyncExternalStore`/refs/event-driven; lint contra suscripción manual en useEffect |
| Sello legal oculto por CSS/overflow | Baja | Crítico | `legal-seal` con z-index fijo y test que verifica visibilidad; no ocultable por props |
| Entrega disparada saltando guard (UX) | Baja | Alto | El guard real es server-side (F5); FE solo refleja; CTA guía al chat |

## Security Considerations
- Ninguna clave ni prompt en cliente; toda IA pasa por F5/F3 server-side.
- No renderizar HTML crudo de la memoria de materiales (evitar XSS); texto sanitizado/escapado.
- El sello legal y disclaimer no dependen de input del usuario; fuente única (contratos/F5).
- Validar/limitar el asset de render3d (origen del proveedor, no URLs arbitrarias del usuario).

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor):
- **Sello en el export, no solo en DOM** (e2e/Playwright): el flujo chat→entrega con IA mockeada genera un entregable; el export (`toDataURL`/PDF) **contiene** el sello (capa Konva/server-side), no solo el overlay DOM. Rojo si el sello vive únicamente en el DOM.
- **Preview de coste antes de generar** (e2e/Playwright + component): la UI muestra el coste ANTES del hold y solo al confirmar dispara `advance`. **Cuando F8 reporta `isFree`** (primer entregable / iteración en garantía) la UI muestra **GRATIS** (no "~N créditos"); cuando es de pago muestra "~N créditos, confirmar". Rojo sin el gate de confirmación o si no distingue gratis de pago.
- **Streaming incremental sin useEffect** (component/Vitest): el hook acumula `AgentStreamEvent` vía `useSyncExternalStore`; render incremental de tokens. Verde al implementar el hook.
- **Stepper sincronizado** (component): Entrega deshabilitada hasta que el guard legal de F5 reporta OK.
- **Mock:** el flujo e2e corre con `ChatVisionAdapter`/`ImageAdapter` mockeados y DB efímera (cero red a IA). NO se mockea el render del sello en el Stage (es lo que se valida en el export).

## Next Steps
Desbloquea **F7** (feedback por zona: el panel/canvas de entregables es el punto de selección de zona) y aporta la UI donde **F8** insertará el gating de features free/premium y el saldo de créditos.
