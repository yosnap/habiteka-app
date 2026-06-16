# Validación de Consistencia — Habiteka MVP (plan por equipo)

> Revisión de DOCUMENTOS de plan (no de código). 15 fases F0–F14 + plan.md + system-architecture.md.
> Fecha: 2026-06-16. Tras correcciones del panel Predict.

## Inconsistencias

### Alta
- **Tabla de roles vs globs de fase (F2 sobre-amplio).** plan.md L13 declara BE owner de `src/server/**` y `src/app/api/**` completos. Eso engloba a F3 (`src/server/ai/**`), F5/F7 (`src/server/agent/**`), F8 (`src/server/billing/**`), F14 (`src/server/privacy/**`) y todos los `api/{iterations,webhooks,voting,marketplace}`. El cuerpo de F2 SÍ se acota (db/auth/actions + api/auth + api/health), pero la **matriz maestra de plan.md no**. Owner real de `src/server/**` ambiguo → riesgo de colisión de edición. Fases: plan.md, F2 vs F3/F5/F7/F8/F14.
- **Grafo ASCII ≠ tabla de fases para F6.** El ASCII (L27) dice `F1,F2,F4 ──> F6`; la tabla (L51) y el header de F6 dicen *Depende de F4,F5*. F5 falta en el ASCII de F6 y F1/F2 sobran (son transitivas vía F4). Fases: plan.md, F6.

### Media
- **`agent-stream` / `AgentStreamEvent`: productor declarado de forma inconsistente.** F0 dice "contrato entre el orquestador (servidor) y el hook UI"; F5 lo emite vía `chatStream`, pero el `chatStream` real lo expone F3 (`ChatVisionAdapter`) que produce `ChatDelta`, no `AgentStreamEvent`. Falta declarar quién traduce `ChatDelta`→`AgentStreamEvent` (¿F5 orquestador?). Consumidor F6 OK. Fases: F0, F3, F5, F6.
- **`AgentState.collected` persistencia: nombres de tabla divergen.** F5 persiste en `project_state` (JSONB); F2 modela el estado como parte de `Project`/`Conversation` y NO declara tabla/campo `project_state` ni `AgentState` explícito en su lista de modelos (L28). F5 asume un store que F2 no nombra. Fases: F2, F5.
- **Grafo: F11 y F14 colgados del bloque derecho del ASCII.** Las líneas de F8/F9/F10/F11/F14 quedan visualmente bajo una barra `│` que sugiere dependencia de F5 que no existe (F11 depende solo de F0; F14 solo de F2). Es ruido de diagrama, no dependencia real, pero induce error. Fases: plan.md.

### Baja
- **`canva-flow.md` referenciado pero no verificado.** F1/F4/F5/F6/F7 enlazan `docs/canva-flow.md` como fuente; no forma parte del set revisado (existe fuera del plan). No es inconsistencia interna del plan si el archivo existe.
- **Conteo de modelos en F2 oscila 13/14.** Todo List dice "14 modelos (incl. ProcessedWebhookEvent)"; Success Criteria dice "13 modelos + tablas auth". Recuento real ≈15 (incl. Addon). Cosmético. Fases: F2.

## Solapes de propiedad

- **`src/server/**` (CRÍTICO de redacción, no de diseño):** la matriz de plan.md asigna todo `src/server/**` a BE/F2, pero el diseño real lo parte por subárbol (db/auth/actions=F2, ai=F3, agent=F5, agent/feedback=F7, billing=F8, privacy=F14). Los cuerpos de fase son disjuntos y correctos; **solo la tabla maestra solapa**. Acción: acotar el glob de F2 en plan.md L13.
- **`src/app/api/**` (mismo caso):** plan.md L13 da todo `src/app/api/**` a F2, pero `api/iterations`=F7, `api/webhooks/polar`+`api/billing`=F8, `api/voting`=F9, `api/marketplace`=F10. F2 real = `api/auth` + `api/health`. Acotar en tabla maestra.
- **F5 vs F7 sobre `src/server/agent/**`:** RESUELTO correctamente — F5 declara exclusión explícita de `agent/feedback/**` (L70) y F7 lo posee. Sin solape.
- **F7 vs F3 sobre imagen/inpaint:** RESUELTO — F7 vive en `agent/feedback/**` + `api/iterations/**`, consume `ImageAdapter.inpaint` vía interfaz, NO edita `src/server/ai/**`. Confirmado en F7 L15/L52/L90 y nota plan.md L39/L81. Sin solape.
- **F14 vs F13 vs F2:** disjuntos. F14=`docs/legal/**`+`src/server/privacy/**`; F13=`LICENSE`+`src/lib/licensing/**`+`docs/licensing.md`; F2=`prisma/**`. Sin solape (F14 coordina campos aditivos vía F2, no edita `prisma/**`).
- **`prisma/**` F2 vs F10:** RESUELTO — F10 solo posee `prisma/seed/marketplace.ts`; F2 posee `prisma/schema/**`. Disjunto.
- **`.env.example`:** tocado por F0 (crea), F2/F8/F11/F13 (añaden). Multi-editor declarado como "coordinar", no asignado a un owner único. Riesgo bajo de conflicto pero sin dueño claro.

## Contratos huérfanos o faltantes

- **`product-drop-payload.ts` / `ProductDrop` — HUÉRFANO.** F0 lo define como contrato FE↔FE (marketplace→canvas, `{marketplaceItemId,stageX,stageY,targetRef?}`). **Ningún consumidor lo nombra:** F4 usa su tipo propio `ProductRef{id,marketplaceItemId,x,y}` (F4 L60) y F10 habla de "payload del producto" genérico (F10 L48/L72) sin citar `ProductDrop`. Contrato definido que nadie referencia explícitamente. Acción: que F4 y F10 consuman `ProductDrop` o eliminar el contrato.
- **`design-element.ts` / `DesignElement.targetRef` — parcialmente consumido.** F9/F10 usan `targetRef` (votación/marketplace) y F7 lo lista como contrato leído, pero ninguna fase nombra `DesignElement` como tipo; usan `targetRef` suelto. Aceptable pero el tipo contenedor queda sin consumidor nominal. Fases: F0, F7, F9, F10.
- **`plano2d-payload` / `Plano2dPayload` — OK.** Productor F5 (entrega), consumidores F6 (visor) y F7 (regeneración parcial). Coherente.
- **`canvas-zone` / `CanvasZone` — OK.** Productor F4/F6 (selección), consumidor F7 (mask-builder). Coherente.
- **`AgentState.collected` (guard legal) — OK.** Definido F0, consumido F5 (guard de entrada a Entrega). Coherente.
- **Falta contrato del servicio débito hold/settle.** F5/F7 consumen `debit-service.hold/settle/revert` de F8, pero ese servicio NO está en los 10 contratos congelados de F0 (es API de F8, no tipo compartido). Como F5/F7 dependen de su firma y F8 es M3 (posterior a M2 donde corre F5/F7), hay **acoplamiento temporal**: F5 (M2) consume una API de F8 (M3) aún no escrita. Necesita interfaz/stub del débito en F0 o F2 para no bloquear M2. Fases: F0/F2, F5, F7, F8.

## Fixes del Predict — integración

- **F7 ya NO escribe en `src/server/ai/image/`** — confirmado en todo el documento; consume `inpaint` vía interfaz. Bien integrado.
- **F13 ya NO vende el JWT como barrera anti-fork** — F13 es explícito: control "LEGAL + OPERATIVO", el JWT es gate de UX/billing/scope, un fork con su key funciona. Bien integrado. **PERO** system-architecture.md L64 y §8 L129 SIGUEN diciendo *"Un fork self-hosted sin la key no puede consumir el agente"* y *"JWT firmado valida licencia antes de consumir IA"* en tono de barrera técnica → **referencia obsoleta a la versión vieja en el doc de arquitectura** (no en las fases). Acción: alinear arquitectura §3/§8 con la postura corregida de F13.
- **Patrón hold/settle coherente F2↔F5↔F7↔F8** — sí: F2 define schema (`state hold|settled|reverted`, `idempotencyKey` UNIQUE), F8 implementa `hold/settle/revert`, F5/F7 lo consumen con `idempotencyKey=deliverableId+version`. Coherente y sin contradicciones.
- **Estructura estándar:** las 15 fases tienen Overview/Requirements/Architecture/Related Code Files/Implementation Steps/Todo/Success/Risk/Security/Next Steps. F0 fusiona "Context Links" en una línea; el resto completo. Sin fases incompletas.

## Correcciones recomendadas (accionables)

1. **plan.md L13:** acotar globs de F2 a `prisma/**, src/server/{db,auth,actions}/**, src/app/api/{auth,health}/**` (quitar `src/server/**` y `src/app/api/**` genéricos). Elimina el solape de la matriz maestra.
2. **plan.md L27:** corregir dependencia de F6 en el ASCII a `F4,F5 ──> F6` (coherente con tabla/header).
3. **F0/F2:** declarar la **interfaz del débito hold/settle** (o un stub tipado) en `src/lib/contracts` o `src/server` accesible en M2, para que F5/F7 (M2) no dependan de F8 (M3) sin firma. O mover el contrato de débito al freeze gate.
4. **F4 + F10:** consumir explícitamente `ProductDrop`/`product-drop-payload` (o retirar el contrato de F0 si se queda con `ProductRef`).
5. **F0/F5:** especificar quién traduce `ChatDelta` (F3) → `AgentStreamEvent` (F0/F6); nombrar el punto de transformación en F5.
6. **F2/F5:** declarar el store de `AgentState` (campo/tabla, ¿`project_state`?) en la lista de modelos de F2; hoy F5 lo asume sin que F2 lo nombre.
7. **system-architecture.md §3 L64 / §8 L129:** reescribir para reflejar control LEGAL+OPERATIVO (no "fork sin key no puede consumir") — alinear con F13 corregido.

## Veredicto

**Plan consistente: SÍ, con reservas menores.** El diseño de ownership por subárbol es sólido y los fixes del Predict (F7 sin solape, F13 sin falsa-barrera, hold/settle) están bien integrados **en las fases**. Los problemas son de **redacción/sincronización**, no de arquitectura: (a) la tabla maestra de plan.md no refleja el troceo real de `src/server/**` y `src/app/api/**` (solape cosmético pero peligroso si un dev lee solo la tabla); (b) un contrato huérfano (`product-drop-payload`); (c) acoplamiento temporal F5/F7(M2)→F8(M3) por el débito sin contrato congelado; (d) arquitectura.md aún con el discurso viejo del JWT anti-fork. Ninguno bloquea el arranque de M1; los puntos 1, 3 y 7 conviene cerrarlos antes del contract-freeze gate.

## Preguntas no resueltas

- ¿`docs/canva-flow.md` existe y está actualizado? (referenciado por 5 fases, fuera del set revisado).
- ¿El débito hold/settle debe ser uno de los contratos congelados de F0 dado que F5/F7 lo consumen en M2?
