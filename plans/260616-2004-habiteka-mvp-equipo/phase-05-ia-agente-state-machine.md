# F5 — Agente intérprete: máquina de estados de 5 fases (IA Engineer)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) · [canva-flow.md](../../docs/canva-flow.md) · contratos: [phase-00](phase-00-arq-setup-contratos.md) · adaptadores: [phase-03](phase-03-ia-adaptadores.md)

## Overview
- **Rol primario:** IA Engineer
- **Prioridad:** P1 (núcleo operativo; cuello de botella del grafo)
- **Estado:** Planificado
- **Depende de:** F2 (persistencia: `conversations`/`messages`/`project_state`), F3 (adaptadores IA)
- **Paralela con:** F4 (canvas)
- **Descripción:** Orquestador del agente como **máquina de estados** persistida por proyecto sobre las 5 fases del flujo (Ingesta→Cualificación→Entrega→Feedback→Add-ons). Consume `ChatVisionAdapter`/`ImageAdapter` de F3 **vía interfaz** (no los reimplementa). Cada turno y el estado de fase se persisten. Regla legal dura: no se genera ningún entregable sin estilo+tipo validados en chat.

## Key Insights
- El agente es **orquestación**, no IA: decide transición de fase, arma prompts/tools, invoca adaptadores F3, valida salidas, persiste. La IA cruda vive en `src/server/ai/**` (F3).
- **Contratos de F0:** el plano 2D se emite con el schema `Plano2dPayload` (F0, congelado); el streaming de cualificación usa `AgentStreamEvent` (F0); el guard legal lee `Collected` tipado (F0: `{ objetivo?, estilo?, entregables[], detected? }`).
- **Débito hold/settle (F8):** la entrega **reserva** créditos (hold) ANTES de generar, **confirma** (settle) al persistir el entregable, y **revierte** si la generación falla. La `idempotencyKey` es **por OPERACIÓN** (no solo `deliverableId+version`): la entrega inicial, un reintento y una regeneración son operaciones distintas con clave propia, sobre el `CreditHold` (máquina de estados) de F8/F2 → un reintento no doble-cobra y un settle-tras-revert se rechaza.
- **Confirmación de detección (Ingesta→Cualificación):** tras la visión, el usuario **confirma lo detectado** (muros/ventanas/etc.) ANTES de que el flujo gaste créditos en la entrega → evita cobrar sobre una detección errónea.
- Transiciones permitidas (DAG con bucle en feedback): `ingesta→cualificacion→entrega→feedback⇄entrega→addons`. Toda transición valida precondiciones (guards).
- **Cualificación = tool-calling**: el modelo pregunta hasta consolidar `{ objetivo, estilo, entregables }`. Loop manual: append `assistant.tool_calls` → ejecutar tool server-side → push rol `tool` → re-llamar (firma confirmada, F3 Key Insights).
- Estilos cerrados: `modernista|nordico|industrial|clasico|retro` (+ texto libre como nota). Validación de estilo+tipo es **guard de entrada a Entrega**.
- **Entrega = structured outputs**: plano 2D como JSON estructurado (`response_format json_schema strict`, schemas de F3 `schema/plano2d`), render 3D + memoria de materiales vía `ImageAdapter.generate`/chat. Todo entregable lleva `legalSeal` (sello indeleble §4) inyectado por el agente, no por el modelo.
- **Idempotencia/concurrencia:** transiciones de fase serializadas por proyecto (lock optimista por `version`/`updatedAt` de `AgentState`) para evitar doble-entrega en turnos concurrentes.
- Sin estado mutable de proceso: el estado vive en DB; el orquestador es stateless por request (alineado con factories sin estado de F3).

## Requirements
**Funcionales**
- `advance(projectId, input)`: avanza la SM una transición según fase actual + input, persiste, devuelve nuevo `AgentState` + mensajes generados.
- Fase 1 Ingesta: invocar visión (F3) sobre la imagen → elementos estructurales (muros/ventanas/puertas/pilares/límites) como JSON validado; emitir disclaimer legal; **paso de confirmación del usuario** sobre lo detectado (se guarda en `Collected.detected`) antes de avanzar.
- Fase 2 Cualificación: diálogo tool-calling hasta consolidar requisitos; exponer streaming para UI (F6) vía `AgentStreamEvent` (F0) reusando `chatStream`.
- Fase 3 Entrega: **reservar créditos (hold)** → generar plano2d (`Plano2dPayload`), render3d (imagen), memoria (texto) según entregables pedidos; sellar legalmente; persistir `Deliverable[]`; **confirmar débito (settle)** o **revertir** si falla. Idempotente por `deliverableId`+`version`.
- Persistir cada turno (`messages`) y `AgentState` (`project_state`, JSONB serializable de F0).
- **Guard legal:** Entrega rechaza si falta estilo o tipo de entregable validado en chat → error de dominio claro, no excepción genérica.

**No funcionales**
- Orquestador stateless; estado solo en DB. Lock por proyecto en transiciones.
- Prompts versionados y centralizados; sin claves ni `openai` importado aquí (solo interfaces F3).
- Archivos ≤200 líneas; un fichero por fase/responsabilidad.
- Errores de IA (F3 `AiError`) traducidos a errores de dominio del agente (reintento de reparación 1 vez para schema inválido).

## Architecture
```
src/server/agent/
  orchestrator.ts          # advance(): resuelve fase actual → handler → persiste + transición
  state-machine.ts         # transiciones permitidas + guards (incl. guard legal estilo+tipo)
  phases/
    ingesta.ts             # visión → elementos estructurales JSON + disclaimer
    cualificacion.ts       # loop tool-calling → requisitos consolidados
    entrega.ts             # plano2d (json_schema) + render3d (image) + memoria; aplica legalSeal
  tools/
    qualification-tools.ts # defs de tools (set_objetivo, set_estilo, set_entregables, finalizar)
  prompts/
    *.ts                   # system prompts por fase (versionados)
  persistence/
    state-repo.ts          # carga/guarda AgentState (project_state) con lock optimista
    message-repo.ts        # append turnos (conversations/messages)
  legal/
    seal.ts                # texto del sello indeleble + disclaimer (fuente única)
  errors.ts                # AgentError (phase_guard|legal_block|schema_repair_failed|conflict)
  index.ts                 # getAgent() → orquestador con adaptadores F3 inyectados
```
**Data flow (entra→transforma→sale):**
- Ingesta: `{ imageRef }` → `ChatVisionAdapter.chat({ messages:[img], responseSchema:elementos })` → `StructuralElements` + disclaimer → **confirmación del usuario** (guarda en `Collected.detected`) → persist; transición a Cualificación.
- Cualificación: `{ userMessage }` → loop tool-calling (tools ejecutan `state-repo` updates de `Collected`) → stream `AgentStreamEvent` a UI → cuando `finalizar` y guard legal OK → `RequisitosConsolidados`; transición a Entrega.
- Entrega: `{ requisitos, elementos }` → **`debit-service.hold()`** (F8, idempotencyKey por operación de entrega) → por cada entregable pedido: plano2d (`Plano2dPayload` json_schema), render3d (`ImageAdapter.generate`), memoria (chat) → `seal.ts` añade `legalSeal` → persist `Deliverable[]` → **`settle()`** (o `revert()` si falló) → transición a Feedback. **Feedback es F7.**

## Related Code Files
**A crear (owner IA — `src/server/agent/**`):** todos los ficheros del árbol (excepto `agent/feedback/**`, reservado a F7).
**Lee (no edita):** `src/lib/contracts/**` (F0: `ChatVisionAdapter`, `ImageAdapter`, `AgentState`, `Deliverable`); `src/server/ai/**` (F3: solo `index.ts` factories).
**NO tocar:** `src/server/ai/**` (impl F3), `src/server/agent/feedback/**` (F7), `prisma/**`/`src/server/db|auth|billing` (F2/F8), `src/app/**`, `src/components/**`.
**Owner glob:** `src/server/agent/**` excluyendo `src/server/agent/feedback/**` (F7).

## Implementation Steps
1. `state-machine.ts`: enum de fases (de F0 `AgentPhase`), mapa de transiciones permitidas, `canTransition()` + guards. Guard legal: a Entrega solo si `collected.estilo` y `collected.entregables.length>0` validados en chat.
2. `persistence/state-repo.ts` + `message-repo.ts`: cargar/guardar `AgentState` con lock optimista (`version`); append de mensajes. Usar repos de F2 (sin tocar schema).
3. `prompts/*.ts`: system prompts por fase, versionados, con instrucción de NO inventar el sello (lo pone el servidor).
4. `tools/qualification-tools.ts`: defs JSON de tools (`set_objetivo`, `set_estilo`(enum), `set_entregables`(enum[]), `finalizar`). Handlers escriben en `collected`.
5. `phases/ingesta.ts`: armar mensaje multimodal (imagen) + `responseSchema` elementos; devolver elementos + disclaimer (`legal/seal.ts`); marcar pendiente de **confirmación** del usuario (guard que impide avanzar sin `Collected.detected` confirmado).
6. `phases/cualificacion.ts`: loop tool-calling (append assistant→exec tool→push role `tool`→re-call) hasta `finalizar`; emitir `AgentStreamEvent`; consolidar requisitos en `Collected`.
7. `phases/entrega.ts`: `debit-service.hold()` (idempotencyKey) → generar entregables pedidos (`Plano2dPayload`) → inyectar `legalSeal` → persistir → `settle()`; si algo falla → `revert()`. Reintento de reparación 1 vez si JSON no valida.
8. `orchestrator.ts` + `index.ts`: `advance()` despacha por fase, inyecta adaptadores F3, persiste, transiciona. `getAgent()` sin estado por request.
9. `errors.ts`: `AgentError` tipado; mapear `AiError` de F3.
10. Tests: ver sección **TDD / Pruebas primero** (escribir antes del handler de cada fase). `pnpm typecheck` + `build` verdes.

## Todo List
- [ ] State machine + transiciones + guards (incl. guard legal)
- [ ] Repos de estado (lock optimista) y mensajes
- [ ] Prompts versionados por fase
- [ ] Tools de cualificación + handlers
- [ ] Fase Ingesta (visión → elementos + disclaimer + confirmación del usuario)
- [ ] Fase Cualificación (loop tool-calling → requisitos, stream `AgentStreamEvent`)
- [ ] Fase Entrega (hold→genera→settle/revert; `Plano2dPayload` + render3d + memoria + sello)
- [ ] Orquestador `advance()` + `getAgent()` stateless
- [ ] Errores de dominio mapeando `AiError`
- [ ] Tests de guard legal, loop, persistencia, sello — verdes

## Success Criteria
- `advance()` recorre Ingesta→Cualificación→Entrega persistiendo estado y turnos.
- Intentar Entrega sin estilo+tipo validados → `AgentError(legal_block)`, sin llamar a la IA de generación.
- Todo `Deliverable` emitido incluye `legalSeal` con el texto exacto del §4.
- Cualificación consolida `{objetivo, estilo, entregables}` vía tool-calling (test verde).
- Cero `import 'openai'` ni claves en `src/server/agent/**`.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Modelo "entrega" antes de validar estilo (salta el flujo) | Media | Crítico | Guard legal en `state-machine` server-side; el sello/entrega no dependen de obediencia del modelo |
| Turnos concurrentes → doble entrega / estado corrupto | Media | Alto | Lock optimista por `version` de `AgentState`; transición rechaza en conflicto (`AgentError(conflict)`) |
| Loop tool-calling no termina (sin `finalizar`) | Media | Medio | Límite de turnos + prompt que fuerza `finalizar`; corte con mensaje al usuario |
| JSON de plano2d no valida el schema | Media | Alto | `responseSchema` strict + reintento de reparación 1 vez; si falla → `AgentError(schema_repair_failed)` |
| Cobro por entrega que falla a mitad | Media | Alto | Patrón hold/settle (F8): reserva antes de generar, confirma al persistir, revierte si falla; idempotencyKey por operación evita doble-cobro |
| Gasto de créditos sobre detección errónea | Media | Medio | Confirmación del usuario de lo detectado (Ingesta) antes de gastar en la entrega |
| Acoplamiento al SDK si se llama IA directa | Baja | Alto | Solo interfaces F0; lint contra `import 'openai'` en `agent/**` |

## Security Considerations
- Ninguna clave aquí; IA accedida solo por `getChatVisionAdapter()`/`getImageAdapter()` (F3, único punto que F13 protege).
- Disclaimer (Ingesta) y `legalSeal` (Entrega) son **obligatorios e indelebles**: fuente única en `legal/seal.ts`, nunca generados por el modelo.
- No persistir datos sensibles del prompt fuera de `messages`; loggear solo metadatos (fase, modelo, tokens).
- Validar tamaño/MIME de imagen antes de pasarla al adaptador de visión (BE valida upload aguas arriba).

## TDD / Pruebas primero
Escribir ANTES del handler de cada fase (rojo→verde→refactor), integration/Vitest con **adaptadores F3 mockeados** + DB de test:
- **Guard legal**: `advance` a Entrega sin `estilo` o con `entregables` vacío → `AgentError(legal_block)` y la IA de generación NO se invoca. Rojo sin el guard en la state machine.
- **Confirmación de detección**: tras Ingesta, no se avanza a Cualificación/Entrega hasta que `Collected.detected` está confirmado. Verde al añadir el guard de confirmación.
- **hold antes de generar / revert si falla**: Entrega llama `debit-service.hold()` antes de generar; si la generación falla → `revert()`; al persistir → `settle()`. Mock del stub de débito asevera el orden.
- **legalSeal inyectado por servidor**: todo `Deliverable` emitido lleva `legalSeal` con el texto de `seal.ts`, aunque el modelo no lo devuelva.
- **Concurrencia**: dos `advance` concurrentes → uno gana, el otro `AgentError(conflict)` (lock optimista por `version`).
- **Mock:** se mockean `ChatVisionAdapter`/`ImageAdapter` (fakes con structured outputs y `assetUrl` deterministas) y el `DebitService` (stub de F0). NO se mockea la state machine, los guards ni la persistencia (lógica propia bajo prueba).

## Next Steps
Desbloquea **F6** (UI chat + entregables, consume `advance`/`chatStream` y renderiza `Deliverable`) y **F7** (feedback por zona, que extiende la SM en `agent/feedback/**` con la fase 4 ⇄ entrega). El `usage`/`cost` de cada operación fluye a **F8** (créditos).
