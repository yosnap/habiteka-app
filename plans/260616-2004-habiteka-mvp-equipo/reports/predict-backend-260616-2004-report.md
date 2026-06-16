# Predict — Backend Senior · Revisión del plan Habiteka MVP

> Lente: schema Prisma, concurrencia de créditos, orquestador agente, auth/RBAC, webhooks. Foco F2/F5/F7/F8.

## Huecos

### Alta
- **Débito vs generación NO transaccional (doble gasto / gasto fantasma).** F8 dice "débito previo o reserva" pero la IA (F5/F7) corre fuera de la tx del ledger. Si la IA falla tras debitar → cobro sin entregable; si entrega antes de debitar → entregable gratis. Falta patrón **reserva→confirma/revierte** (hold + settle). [F5, F7, F8]
- **Idempotencia del débito ausente.** F8 solo idempotentiza webhooks Polar. Un retry de `advance()`/`POST /api/iterations` re-debita la misma operación. Falta `idempotencyKey` (ej. `deliverableId+version`) UNIQUE en `CreditLedger`. [F5, F7, F8]
- **`getBalance` por suma sin snapshot ni lock = race en saldo.** Ledger append-only auditable, pero el check "saldo suficiente" lee Σ delta sin `SELECT FOR UPDATE`/advisory lock por `userId`. Dos operaciones concurrentes pueden pasar el check y dejar saldo negativo pese al "lock" mencionado sin mecanismo concreto. [F2, F8]
- **Autorización por recurso no definida en F7.** `POST /api/iterations` valida "dueño del proyecto", pero no se especifica scoping multi-tenant: ¿en B2B un `member` de otra org puede iterar un `Deliverable` de la org? Falta el predicado de autorización concreto (userId+organizationId) por recurso. [F2, F7]
- **Webhooks Polar: persistencia de event-id no modelada.** Se exige dedup "por webhook-id persistido" pero NO hay tabla/modelo `ProcessedWebhookEvent` en el schema de F2. Sin ella la idempotencia no existe. [F2, F8]

### Media
- **Versionado del canvas JSONB sin estrategia de concurrencia.** `Project 1──1 CanvasState` con "+versión" pero F4 (FE) y F5 (agente) escriben el mismo canvas. Falta lock optimista en CanvasState (igual que AgentState). Riesgo de last-write-wins perdiendo trazos del usuario. [F2, F4, F5]
- **Soft-delete / retención ausente.** No hay `deletedAt` en Project/Deliverable. GDPR + "versiones inmutables" chocan: ¿cómo se borra una cuenta sin romper el ledger append-only ni el historial? Definir política. [F2]
- **Timeouts/cancelación del agente sin presupuesto.** F5 stateless por request, pero `advance()` con visión+structured+imagen puede exceder timeout de Server Action / serverless. No hay límite de duración, cancelación ni reanudación parcial. [F5, F7]
- **Re-emisión de créditos por renovación sin anclar al ciclo.** F8 "renovación re-emite créditos" sin idempotencia por periodo de facturación → un `subscription.updated` repetido podría re-acreditar. Anclar a `billingCycleId`. [F8]
- **`assetUrl` de imágenes sin firma ni propiedad.** F7 menciona "URLs firmadas" pero el modelo `Deliverable.payload`/`MarketplaceItem` no define almacenamiento ni control de acceso a assets render3d. [F3, F7]

### Baja
- **Migraciones/seeds: sin estrategia de seed para `pricing-table` y add-ons.** Tarifas y catálogo marketplace son datos, no código; faltan seeds versionados/reproducibles. [F2, F8, F10]
- **Índices compuestos no especificados.** Se citan índices en FKs sueltas; faltan compuestos para queries reales (`CreditLedger(userId, createdAt)`, `Message(conversationId, createdAt)`, `Deliverable(projectId, version)`). [F2]

## Riesgos
- **Saldo negativo bajo concurrencia** — el "lock por userId" se menciona pero no se especifica mecanismo (advisory lock vs SERIALIZABLE vs SELECT FOR UPDATE sobre fila de balance materializado). Sin balance materializado, lock sobre append-only es ambiguo. [F8]
- **Costes descontrolados de IA** — render3d/inpaint sin cap por usuario/proyecto antes de invocar; gating solo por saldo no frena un loop de feedback abusivo. [F7, F8]
- **Acoplamiento de schema F2↔F8↔F5** — F8 "no toca prisma/**" pero necesita modelos (ProcessedWebhookEvent, idempotencyKey, hold/reserva). Si F2 cierra schema sin estos campos, F8 se bloquea. Riesgo de orden en el grafo. [F2, F8]
- **OAuth/sesión: falta rotación y revocación** — no se menciona expiración de sesión, CSRF en Server Actions ni revocación al cambiar plan/rol. [F2]

## Mejoras
- **Balance materializado + ledger append-only.** Mantener `CreditAccount.balance` (mutable, con lock de fila) como caché autoritativa del check, y el ledger como auditoría. Débito = UPDATE balance + INSERT ledger en una tx. Resuelve race y `getBalance` O(1). [F2, F8]
- **Patrón hold/settle para créditos.** `reserve(userId, estCost, opKey)` → genera asset → `settle(opKey, realCost)` o `release(opKey)`. Estado `PENDING|SETTLED|RELEASED` en la transacción. Cubre fallo de IA sin cobro fantasma. [F5, F7, F8]
- **`idempotencyKey` UNIQUE** en débitos e iteraciones, derivado de `deliverableId+version+phase`. INSERT idempotente. [F5, F7, F8]
- **Mover orquestación larga a job/route handler con streaming** en vez de Server Action; añadir `AgentRun` con estado (`RUNNING|DONE|FAILED|TIMED_OUT`) para reanudar/auditar. [F5, F7]
- **Definir `organizationId` en Project + filtro obligatorio** en todas las queries (helper `scopedWhere`) para garantizar aislamiento B2B en una sola capa. [F2]
- **Modelar `ProcessedWebhookEvent(eventId PK, type, processedAt)`** explícitamente en billing.prisma. [F2, F8]

## Preguntas abiertas
1. ¿El check de saldo será sobre balance materializado (recomendado) o suma del ledger? Define el mecanismo de lock concreto.
2. En B2B, ¿los créditos/proyectos son por **usuario** o por **organización**? El schema actual liga CreditLedger a User, pero el negocio (§8) es org-comercial. Impacta FKs y autorización.
3. ¿Se debita antes o después de la IA? Sin hold/settle hay que elegir y aceptar el modo de fallo.
4. ¿Política de retención/borrado (GDPR) compatible con ledger append-only e iteraciones inmutables?
5. ¿Quién posee los modelos nuevos que F8/F5/F7 necesitan en prisma (idempotency, webhook events, hold)? El grafo dice F2 cierra schema antes que F8 arranque.

**Status:** DONE
