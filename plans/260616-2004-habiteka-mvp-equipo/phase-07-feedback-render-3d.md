# F7 — Feedback por zona + Render 3D / Inpainting (IA + Backend)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) · [canva-flow.md](../../docs/canva-flow.md) (Fase 4) · contratos: [phase-00](phase-00-arq-setup-contratos.md) · agente: [phase-05](phase-05-ia-agente-state-machine.md) · adaptadores: [phase-03](phase-03-ia-adaptadores.md)

## Overview
- **Rol primario:** IA + Backend
- **Prioridad:** P1 (MVP incluye feedback por zona + render 3D — decisión usuario)
- **Estado:** Planificado
- **Depende de:** F5 (state machine y entregables), F6 (UI de selección en panel/canvas), F3 (consume `ImageAdapter.inpaint` vía interfaz — no edita su subárbol)
- **Paralela con:** F9, F10 (add-ons)
- **Descripción:** Implementa la **Fase 4** del flujo: feedback por **zona**. El usuario selecciona objeto/pared/área → modificación **selectiva** manteniendo el resto intacto. Render 3D fotorrealista + **inpainting/edición dirigida** vía `ImageAdapter`. Regeneración **parcial** estructurada del plano 2D. **Versionado** de iteraciones. Extiende la SM de F5 sin reescribirla.

## Key Insights
- **Modificación selectiva = no regenerar todo.** Para imagen (render3d): `ImageAdapter.inpaint` con máscara de la zona. Para plano2d (JSON): regeneración **parcial** del subárbol de la zona (no del documento completo) vía structured output sobre el fragmento.
- **F7 vive ÍNTEGRAMENTE en `src/server/agent/feedback/**`** (F5 no toca esa carpeta) **+ `src/app/api/iterations/**`**. NO toca el subárbol `src/server/ai/**` de F3 → cero solape de ownership con el adaptador de imagen. Reusa `state-machine`/repos de F5 vía import, no los duplica.
- La **máscara/zona** la define la UI (F6) sobre el canvas: coords/bbox del objeto seleccionado → enviadas al endpoint de iteración. Backend traduce a máscara para `inpaint`.
- **Inpainting dirigido es específico de F7**, pero la *primitiva* `inpaint` ya la expone F3 (`ImageAdapter.inpaint`). F7 construye máscara y prompt dirigido en **`src/server/agent/feedback/**`** (mask-builder + directed-inpaint) y **consume `ImageAdapter.inpaint` puro vía interfaz** — no edita ni añade nada en `src/server/ai/image/**` (cero solape con F3).
- **Versionado:** cada iteración crea una nueva `Deliverable.version` (+ fila `Iteration` del modelo §5) preservando la anterior → comparación/rollback. Inmutabilidad de versiones previas.
- Transición de SM: `feedback ⇄ entrega` (refinamiento) sin perder el guard legal ni el `legalSeal` (se reaplica a cada versión).
- Coste: `inpaint`/regeneración reportan `usage`/`cost` (F3) → débito de créditos (F8). Endpoint de iteración hace el débito vía servicio de F8 (no reimplementa ledger). **idempotencyKey por OPERACIÓN** (cada iteración/regeneración es una operación distinta, con su clave sobre el `CreditHold` de F8) → un reintento de la misma iteración no doble-cobra.
- **Scoping estructural obligatorio:** `/api/iterations` accede a `Deliverable`/`Iteration` **solo** vía el repo `withOrg(orgContext)` de F2 (no hay ruta de acceso sin scoping) → el dueño de otra org no puede iterar sobre un entregable ajeno (anti-IDOR por construcción).

## Requirements
**Funcionales**
- Endpoint de iteración: recibe `{ projectId, deliverableId, zone, instruction }` → modifica solo la zona → nueva versión.
- Inpainting de render3d: construir máscara desde `zone` + prompt dirigido → `ImageAdapter.inpaint` → nuevo asset.
- Regeneración parcial de plano2d: aplicar cambio al subárbol de la zona manteniendo el resto del JSON byte-idéntico fuera de la zona.
- Versionado: persistir nueva versión + `Iteration`; versiones previas inmutables; listar historial.
- Reaplicar `legalSeal` a cada versión generada.

**No funcionales**
- Modificación atómica por iteración (transacción): o se crea versión completa o nada.
- Concurrencia: serializar iteraciones por `deliverableId` (lock) para versionado consistente.
- Archivos ≤200 líneas; toda la lógica en `agent/feedback/`; la primitiva de imagen se consume vía interfaz F3 (no se edita `ai/**`).
- Sin claves fuera de `src/server/**`; `inpaint` accedido por la interfaz de F3.

## Architecture
```
src/server/agent/feedback/
  feedback-orchestrator.ts   # entra zone+instruction → decide image|plano2d → adapta → versiona
  zone-resolver.ts           # CanvasZone (bbox/objeto de UI) → región normalizada
  mask-builder.ts            # zona → máscara para inpaint (consume CanvasZone de F0)
  directed-inpaint.ts        # prompt dirigido + ImageAdapter.inpaint puro (interfaz F3, no lo reimplementa)
  partial-plan-editor.ts     # regeneración parcial del subárbol plano2d (json_schema del fragmento)
  iteration-repo.ts          # crea Iteration + nueva Deliverable.version (tx); historial; inmutabilidad
src/app/api/iterations/
  route.ts                   # POST crea iteración; GET historial (route handler)
```
**Data flow:** UI (F6) selecciona zona → `POST /api/iterations { deliverableId, zone, instruction }` → `feedback-orchestrator` resuelve tipo de entregable: si **render3d** → `mask-builder`+`directed-inpaint` (consume `ImageAdapter.inpaint` vía interfaz F3) → nuevo asset; si **plano2d** → `partial-plan-editor` (structured output sobre el fragmento de la zona) → JSON con resto intacto. → `seal.ts`(F5) reaplica `legalSeal` → `iteration-repo` persiste nueva versión + `Iteration` (tx) → débito créditos hold/settle (F8) → responde nueva versión. Transición SM `feedback`.

## Related Code Files
**A crear:**
- IA+BE owner `src/server/agent/feedback/**`: `feedback-orchestrator.ts`, `zone-resolver.ts`, `mask-builder.ts`, `directed-inpaint.ts`, `partial-plan-editor.ts`, `iteration-repo.ts`. Toda la lógica de máscara/inpaint dirigido vive aquí (NO en `src/server/ai/**`).
- BE owner `src/app/api/iterations/`: `route.ts`.
**Lee/usa (no edita):** `src/lib/contracts/**` (F0: `CanvasZone`, `Plano2dPayload`, `DesignElement`); `src/server/ai/index.ts` (`getImageAdapter`, F3) — consume `inpaint` **vía interfaz**; `src/server/agent/legal/seal.ts` + `state-machine.ts` (F5); servicio de débito hold/settle (F8).
**Owner globs:** `src/server/agent/feedback/**`, `src/app/api/iterations/**`.
**NO tocar:** `src/server/ai/**` (TODO el subárbol es de F3 — F7 solo consume `getImageAdapter().inpaint`); `src/server/agent/{orchestrator,phases,state-machine}.*` salvo import (F5); `src/server/billing/**` salvo consumir su servicio (F8).

## Implementation Steps
1. `zone-resolver.ts`: normalizar `CanvasZone` (bbox/objeto de UI, contrato F0) a región/coords estándar; validar contra dimensiones del entregable.
2. `mask-builder.ts` (en `agent/feedback/`): de región normalizada → máscara binaria con el formato que **espera la interfaz `InpaintRequest` de F3** (el formato lo fija el contrato F0, no requiere editar F3).
3. `directed-inpaint.ts`: prompt dirigido + `getImageAdapter().inpaint({ asset, mask, prompt })` (interfaz pura F3); devolver nuevo asset + `cost`.
4. `partial-plan-editor.ts`: localizar subárbol de la zona en el JSON plano2d; regenerar solo ese fragmento (structured output) y fusionar manteniendo el resto idéntico.
5. `iteration-repo.ts`: tx → crear `Iteration` + `Deliverable` v(n+1), marcar previas inmutables; método de historial. Lock por `deliverableId`.
6. `feedback-orchestrator.ts`: despachar por `Deliverable.type` (render3d→inpaint, plano2d→partial); reaplicar `legalSeal` (F5); invocar débito de créditos (F8).
7. `api/iterations/route.ts`: validar payload (auth de F2), invocar orquestador, devolver nueva versión; GET historial.
8. Tests: ver sección **TDD / Pruebas primero** (escribir antes de cada módulo). `pnpm typecheck`/`build` verdes.

## Todo List
- [ ] `zone-resolver` (zona UI → región normalizada)
- [ ] `mask-builder` en `agent/feedback/` (región → máscara, formato del contrato `InpaintRequest`/`CanvasZone` F0)
- [ ] `directed-inpaint` consumiendo `ImageAdapter.inpaint` vía interfaz (F3, sin editar `ai/**`)
- [ ] `partial-plan-editor` (regeneración parcial del JSON, resto intacto)
- [ ] `iteration-repo` (versionado tx + inmutabilidad + historial)
- [ ] `feedback-orchestrator` (despacho + reaplicar sello + débito créditos)
- [ ] `POST/GET /api/iterations` con auth
- [ ] Tests de selectividad, versionado, sello — verdes

## Success Criteria
- Modificar una zona del render3d cambia solo esa región; el resto del asset permanece estable (test).
- Regenerar una zona del plano2d preserva el resto del JSON sin cambios (diff acotado a la zona).
- Cada iteración crea nueva versión; versiones previas inmutables y recuperables.
- `legalSeal` presente en toda versión generada.
- Débito de créditos registrado por cada iteración (vía servicio F8), no reimplementado aquí.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Inpaint "sangra" fuera de la zona | Media | Alto | Máscara ajustada + prompt dirigido; test de estabilidad de píxeles fuera de zona; iterar máscara |
| Regeneración parcial altera nodos fuera de zona | Media | Alto | Editar solo subárbol localizado; merge que conserva el resto; test de diff acotado |
| Solape con `src/server/ai/**` de F3 | Baja | Alto | F7 NO toca `src/server/ai/**`: mask-builder/directed-inpaint viven en `agent/feedback/`; consume `inpaint` vía interfaz. Formato de máscara fijado por contrato `CanvasZone`/`InpaintRequest` de F0 |
| Iteraciones concurrentes corrompen versionado | Media | Alto | Lock por `deliverableId` + tx; rechazar en conflicto |
| Coste de render/inpaint dispara consumo de créditos | Media | Medio | Débito previo a generación o reserva; límite de iteraciones por plan (gating F8) |

## Security Considerations
- Auth/ownership: solo el dueño del proyecto puede iterar sobre su `Deliverable` — acceso **únicamente** vía `withOrg(orgContext)` de F2 (scoping estructural, no olvidable).
- Claves de imagen solo server-side (vía `getImageAdapter`, F3); nunca al cliente.
- Validar `zone` y tamaño de máscara (evitar regiones fuera de límites o payloads abusivos).
- `legalSeal` indeleble reaplicado server-side a cada versión; no confiable desde cliente.
- No exponer URLs internas de assets sin firmar; servir con control de acceso.

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor), integration/Vitest con `ImageAdapter` mockeado + DB de test:
- **Inpaint solo la zona**: modificar una zona del render3d cambia solo esa región; el resto del asset permanece estable (diff de píxeles fuera de zona ≈ 0, contra fake determinista). Rojo sin máscara ajustada.
- **Regeneración parcial plano2d**: regenerar el subárbol de una zona preserva el resto del JSON byte-idéntico (diff acotado a la zona). Verde con `partial-plan-editor`.
- **Versionado + inmutabilidad**: cada iteración crea `Deliverable` v(n+1) + fila `Iteration`; versiones previas inmutables y recuperables. Rojo sin tx de versionado.
- **legalSeal reaplicado**: cada versión generada lleva `legalSeal`. Verde al reaplicar el sello server-side.
- **Mock:** se mockea `ImageAdapter.inpaint` (fake que devuelve asset determinista) y el servicio de débito de F8. NO se mockea el `mask-builder`, `partial-plan-editor` ni el `iteration-repo` (lógica propia bajo prueba).

## Next Steps
Cierra el bucle de refinamiento del flujo. El historial de versiones queda disponible para **F9** (votación sobre una versión concreta) y **F10** (marketplace escanea la versión aprobada). El consumo de créditos se contabiliza en **F8**.
