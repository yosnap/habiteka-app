# RED TEAM — Integridad de datos / Créditos / Concurrencia / Multi-tenancy

Vector: DBA paranoico + sistemas distribuidos. Plan Habiteka MVP. Solo lectura del plan; sin tocar código.
Fases atacadas: F2 (datos/auth/scoping), F5 (estado agente), F7 (iteraciones), F8 (créditos/Polar), F18 (analítica).

## Fallos que funcionan

### CRÍTICO 1 — `idempotencyKey = deliverableId+version` colisiona consigo mismo en hold/settle/revert e iteraciones
El plan usa UNA sola clave `deliverableId+version` para "evitar doble cobro" (F2:24, F8:16, F5:16). Pero esa clave se usa en TRES caminos: `hold`, `settle` y `revert`, y se REUTILIZA en cada regeneración/iteración de F7. Caminos rotos:
- **settle-tras-revert / revert-tras-settle:** si `revert` ya escribió fila con esa key (UNIQUE) y luego llega un `settle` tardío (timeout + entrega que sí llegó), el `settle` choca con UNIQUE → o se pierde el cobro o explota. El plan no define máquina de estados del hold (qué transición es legal desde cada estado).
- **Re-iteración:** F7 crea `Deliverable.version`=n+1, pero un RETRY de la MISMA iteración fallida reusa la version anterior → o doble-genera con key nueva, o colisiona. El plan dice "version" sin definir si la asigna el cliente (IDOR de versión) o el server atómicamente.
La idempotencia está descrita como propiedad de una columna UNIQUE, NO como una máquina de estados (`hold→settled` | `hold→reverted`, terminales). Sin eso, una sola UNIQUE no cubre los 5 caminos.

### CRÍTICO 2 — "saldo materializado con lock de fila" es hand-wavy: no hay fila a bloquear especificada
El plan repite "saldo materializado + lock de fila" (F2:23,42; F8 risk) pero NUNCA dice DÓNDE vive ese saldo. `CreditLedger` es append-only (no es lockeable como saldo). No hay modelo `CreditBalance(userId/orgId, balance, version)` declarado en el schema de F2. Sin una fila-saldo concreta, `SELECT ... FOR UPDATE` no tiene objeto. Escenario que rompe:
- Dos `hold` concurrentes con saldo justo → ambos hacen `SUM(CreditLedger)` (lectura), ambos ven saldo suficiente, ambos insertan hold → **saldo negativo**. El "lock de fila" sobre un agregado de tabla append-only no existe; necesitas o `SELECT FOR UPDATE` sobre una fila materializada, o `SERIALIZABLE`, o un advisory lock por `userId/orgId`. El plan no elige ninguno explícitamente.
El test "saldo no negativo bajo concurrencia" (F2:182) PASARÁ con un mutex ingenuo en un solo proceso pero FALLARÁ en prod multi-réplica si el lock es a nivel app y no a nivel DB.

### CRÍTICO 3 — Scoping multi-tenant: `assertOwnership` es "obligatorio pero olvidable" (opt-in)
F2 declara `assertOwnership`/`loadOwned` y dice "úsalo en TODA query" (F2:47,133,167). Es disciplina manual, no garantía estructural. Rutas que el plan NO obliga a pasar por el helper:
- **F7 `/api/iterations`** (route handler, no Server Action): valida "auth de F2" (F7:65,95) pero NO se cita `loadOwned` sobre `deliverableId`. IDOR directo: itero el Deliverable de otra org pasando su id.
- **F18 analítica:** lee `CreditLedger`/`Deliverable`/`Subscription` "por rango" sin mención de `organizationId` en los agregados (F18:27,48). `requireAdmin` es rol plataforma, NO scoping por tenant → un admin B2B podría ver consumo cross-org si las queries no filtran org (o, peor, fuga entre tenants en export CSV).
- **F9 votación / F10 marketplace:** no auditadas aquí pero heredan el mismo patrón opt-in.
- **`CreditLedger.organizationId` es nullable de facto:** F2 lo pone solo en `Project` y `CreditLedger`. Pero `Subscription` es `User 1──1` (F2:67) SIN orgId → en B2B ¿el saldo es del usuario o de la org? Ambiguo. Un débito puede mirar `userId` y un crédito `orgId` → saldos que no cuadran.

### ALTO 4 — Hold huérfano sin reaper: crédito reservado para siempre
F5 entrega: `hold()` → genera → `settle()`/`revert()`. Si el proceso muere ENTRE hold y settle/revert (crash, timeout de imagen 3D que tarda minutos, deploy de OPS, OOM), el hold queda colgado. No hay:
- `expiresAt` en el hold ni job reaper que revierta holds vencidos.
- El "lock optimista por version de AgentState" (F5:22) NO libera el hold; son mecanismos distintos.
Resultado: usuario con saldo legítimo bloqueado, soporte manual. En B2B con saldo de org, un hold huérfano congela crédito de toda la organización. F7 (render 3D / inpaint, las ops MÁS lentas) es la más expuesta.

### ALTO 5 — AgentState JSONB + lock optimista: el `Collected` se pisa entre tool-calls concurrentes
`AgentState` es un blob JSONB con lock optimista por `version` (F2:64, F5:22). En Cualificación, los tool-handlers (`set_objetivo`, `set_estilo`, `set_entregables`) hacen "updates de `Collected`" (F5:63,76). Problemas:
- **Read-modify-write de blob completo:** dos tool-calls del mismo turno (o usuario + evento de feedback) leen el JSONB, modifican campos distintos, escriben el blob entero → el segundo pisa el campo del primero salvo que el lock optimista aborte y reintente. El plan menciona el lock para "transiciones de fase" (F5:22), NO para writes intra-fase de `Collected`. Lost update silencioso de requisitos.
- El test de concurrencia (F5:126) prueba "dos `advance`" → uno gana con conflict. NO prueba dos escrituras de tool dentro del mismo advance. La granularidad del lock (proyecto entero) serializa de más O de menos según implementación no especificada.

## Garantías que el plan NO da

1. **No-saldo-negativo bajo concurrencia REAL (multi-réplica):** depende de un lock cuya fila/mecanismo no está definido. En un solo proceso de test pasa; en prod con N réplicas + connection pool no está garantizado (falta `FOR UPDATE` sobre fila concreta, `SERIALIZABLE`, o advisory lock por tenant).
2. **Idempotencia total de hold/settle/revert/iteración:** una UNIQUE no es una máquina de estados; settle-tras-revert, doble-webhook con el mismo `order` Polar concurrente (dos workers, ambos pasan el dedup antes de commit), y retry de iteración no están cubiertos. `ProcessedWebhookEvent` UNIQUE no protege contra DOS inserts concurrentes que ambos leen "no procesado" antes de que ninguno commitee, salvo que el INSERT-con-UNIQUE-y-conflict esté en la MISMA tx que el crédito Y se confíe en el error de unicidad (el plan dice "atómico" pero no "INSERT ... ON CONFLICT DO NOTHING dentro de la tx del crédito").
3. **Aislamiento entre tenants:** no hay garantía estructural (RLS de Postgres, o scope forzado en el ORM). Es convención. Una sola Server Action/route que olvide `loadOwned` = IDOR/fuga.
4. **Reconciliación saldo materializado ↔ ledger:** no hay job que verifique `balance == SUM(ledger)`. Si una tx parcial deja el materializado desincronizado del append-only, nadie lo detecta. F18 lee ambos pero no reconcilia.
5. **Atomicidad hold→generación→settle cruzando proceso externo:** la generación (OpenRouter/imagen) NO es transaccional con la DB. Si settle falla DESPUÉS de entregar el asset, el usuario tiene el entregable gratis (o el revert borra un entregable ya servido). No hay outbox/saga.
6. **Orden de migraciones con 20+ modelos + FKs + datos existentes:** F2 declara ~23 modelos multi-file (Prisma `prismaSchemaFolder`). No hay garantía de orden de creación de FKs ni plan para datos existentes en re-deploys; `CreditLedger.organizationId` añadido a tablas con filas previas no tiene backfill definido.

## Recomendaciones accionables

1. **Declarar modelo `CreditBalance(ownerId, ownerScope=user|org, balance int, heldAmount int, version)` explícito** en F2. Débito = `UPDATE ... WHERE balance-heldAmount >= cost` con `RETURNING` (atómico, sin lectura previa) o `SELECT FOR UPDATE` sobre esa fila. El `CHECK (balance >= 0)` a nivel DB como red de seguridad final. Definir si el saldo es por user o por org de forma ÚNICA (no mezclar).
2. **Modelar el hold como entidad con máquina de estados:** `CreditHold(id, ownerId, amount, status=pending|settled|reverted, idempotencyKey UNIQUE, expiresAt, deliverableId, version)`. `settle`/`revert` son transiciones idempotentes que validan estado origen (`pending`→terminal); settle-tras-revert = no-op o error tipado, NUNCA doble efecto. Separar la idempotencyKey de hold (`deliverableId+version`) de la de webhook (`polarEventId`).
3. **Reaper de holds huérfanos:** `expiresAt` (p.ej. 10 min) + job (cron/pg_cron) que revierte `pending` vencidos y libera `heldAmount`. Hacer `hold` idempotente para que un retry tras reaper no doble-cobre.
4. **Forzar scoping estructuralmente, no por disciplina:** (a) Postgres RLS por `organization_id` como defensa en profundidad, o (b) wrapper de Prisma que EXIGE `tenantContext` y rechaza queries sin scope. Auditar explícitamente F7 `/api/iterations`, F9, F10, F18 export y agregados → TODOS deben filtrar por `organizationId`, no solo por sesión. Resolver el orgId de `Subscription`/`CreditLedger` (user vs org) antes del freeze de contratos.
5. **Webhook Polar a prueba de concurrencia:** `INSERT INTO ProcessedWebhookEvent(eventId) ON CONFLICT DO NOTHING` DENTRO de la misma tx que muta crédito; si `rowCount==0` → ya procesado, abortar. Esto cubre dos workers concurrentes (el segundo commit falla/no inserta). Documentarlo como requisito, no como "atómico" genérico.
6. **Versión de Deliverable asignada server-side atómicamente** (`MAX(version)+1` bajo lock por `deliverableId`, o secuencia), nunca desde el cliente → evita IDOR de versión y colisión de iteraciones concurrentes (F7 ya pide lock por deliverableId: extenderlo a la asignación de version).
7. **Granularidad de lock en AgentState:** o serializar tool-writes con el MISMO lock optimista (reintento en conflict) y testearlo explícitamente (dos tool-writes intra-advance), o mover `Collected` a columnas/tabla relacional para writes parciales sin RMW del blob. Añadir test de lost-update intra-fase.
8. **Job de reconciliación** `balance materializado == SUM(ledger settled)` (F18 o cron BE), alerta en drift. Test que lo verifique tras N hold/settle/revert concurrentes.

## Preguntas abiertas
- ¿El saldo de créditos es por `User` o por `organizationId` en B2B? (`Subscription` es 1:1 con User; `CreditLedger` tiene orgId → contradicción a resolver antes del contract freeze).
- ¿Despliegue es single-réplica o multi-réplica? Define si basta lock de fila o hace falta advisory lock/SERIALIZABLE.
- ¿Hay pg_cron / scheduler disponible para reaper y reconciliación, o hay que modelar un worker?

**Status:** DONE
