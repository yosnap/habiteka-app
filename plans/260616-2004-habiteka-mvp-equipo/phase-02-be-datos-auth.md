# F2 — Datos, Auth & Base Backend (Rol BE/Backend)

## Context Links
- Arquitectura: [docs/system-architecture.md](../../docs/system-architecture.md) (§5 modelo de datos, §4 fases)
- Plan general: [plan.md](plan.md)

## Overview
- **Rol primario:** BE/Backend
- **Prioridad:** P1
- **Estado:** Completado (PR #8)
- **Depende de:** F0 (repo, tsconfig, contratos en `src/lib/contracts/**`)
- **Paralela con:** F1, F3, F11
- **Descripción:** Schema Prisma 7 completo + migraciones (incl. 7 modelos de plataforma que consume el back-office), Better Auth 1.6 (email/password + OAuth, sesiones, RBAC B2B/B2C + plugin `admin()` para rol plataforma), cliente Prisma singleton, y estructura base de Server Actions/route handlers. **No** implementa adaptadores IA, state machine ni el back-office (eso es `src/server/ai/**`, `src/server/agent/**` y `src/server/admin/**`/`src/app/(admin)/**`); aquí solo se **declaran** los modelos y el rol que aquellos consumen.

## Key Insights
- `CanvasState` y campos de configuración van como `Json` Prisma → mapea a `jsonb` Postgres por defecto (verificado en docs Prisma data-model).
- Prisma 7 soporta multi-file schema (`prismaSchemaFolder`); dividir el schema por dominio mantiene archivos < 200 líneas.
- RBAC dual: **B2B** vía plugin `organization()` de Better Auth (owner/admin/member + AC custom); **B2C** vía campo `role`/`accountType` en `User`. No construir RBAC propio (DRY/YAGNI).
- **Rol admin de plataforma ≠ B2B/B2C:** un `admin` (back-office) es rol de plataforma, distinto de la cuenta de negocio (org) o individual. Usar el plugin `admin()` de Better Auth 1.6 (roles app `admin`/`user` + `ban`/`impersonate`/`listUsers`) → el back-office solo lo consume; aquí se **declara** en `auth.ts`. No mezclar con `accountType` B2B/B2C.
- **Config dinámica en BD (no redeploy):** mapeo acción→modelo, branding y flags en tablas editables (`ModelConfig`/`BrandSettings`/`SystemSetting`), leídas en runtime con caché. El back-office edita estas tablas pero **no** toca `prisma/**` — los modelos se declaran aquí. `AuditLog` (acciones admin) y `UsageEvent` (telemetría IA, separada del `CreditLedger` contable) son append-only: el productor escribe, el panel solo lee.
- Better Auth genera sus tablas (user, session, account, verification, organization, member, invitation) → no duplicarlas manualmente; referenciarlas en relaciones.
- **3 métodos de acceso (Better Auth 1.6 nativo):** (a) OAuth social `socialProviders.google` + `socialProviders.facebook` (Meta = `facebook`); (b) **email-OTP sin contraseña** vía plugin `emailOTP({sendVerificationOTP})` (tipos `sign-in`/`email-verification`/`forget-password`); (c) email+password clásico. Requiere proveedor de **envío de email** (OTP + verificación): Resend/SMTP a elegir, secret server-side.
- **Turnstile (Cloudflare) como CAPTCHA solo en flujos NO-OAuth:** plugin nativo `captcha({provider:"cloudflare-turnstile", secretKey: TURNSTILE_SECRET_KEY})` — NO construir verificador custom. La verificación server-side ocurre ANTES de crear cuenta / enviar OTP en email/password y email-OTP. **OAuth NO lleva captcha** (el proveedor social ya es la barrera). Site key pública en cliente, secret server-only. Refuerza la cadena anti-sybil existente: Turnstile (no-OAuth) → email verificado → límite por IP → cupo bienvenida finito → cap global.
- **Email verificado = invariante anti-sybil:** si el proveedor social (Meta especialmente) NO aporta email verificado, el usuario completa con email+OTP (`email-verification`) ANTES de poder gastar cupo gratis. El gate de gasto (free-quota-gate, F8) ya exige email verificado; el flujo social incompleto pide verificación.
- **Saldo autoritativo = `CreditBalance` (fila bloqueable), no SUM():** `CreditBalance(organizationId UNIQUE, balance Int, updatedAt)`. Débito = tx: lock fila (`SELECT ... FOR UPDATE`) → verificar `balance ≥ coste` → decrementar → insertar fila en `CreditLedger`. Evita el `SUM()` concurrente que da saldo negativo bajo réplicas. `CreditLedger` queda **solo auditoría append-only** (movimientos), NO fuente del saldo. El test de concurrencia valida **multi-réplica** (lock de fila en DB), no un mutex de proceso (inútil con varias instancias).
- **Idempotencia como máquina de estados — `CreditHold` (no columna UNIQUE suelta):** `CreditHold(idempotencyKey UNIQUE, organizationId, amount, state PENDING|SETTLED|REVERTED|EXPIRED, refType, refId, expiresAt, createdAt, updatedAt)`. `idempotencyKey` **por OPERACIÓN** (no solo `deliverableId+version`): reintento de iteración, regeneración, settle-tras-revert y doble webhook son operaciones distinguibles, cada una con su clave. **Transiciones válidas explícitas:** `PENDING→{SETTLED|REVERTED|EXPIRED}`; los tres son **terminales** (settle-tras-revert se **rechaza**). Reaplicar la misma `idempotencyKey` devuelve el estado sin re-efecto. El débito al `CreditBalance` ocurre en `hold` y se confirma/libera en la transición.
- **Reaper de holds huérfanos:** `CreditHold.expiresAt`; job que revierte holds `PENDING` vencidos (proceso muerto entre `hold` y `settle`/`revert`): `PENDING→EXPIRED` + repone `CreditBalance` (misma tx). Sin reaper, el crédito queda reservado para siempre.
- **Dedup de webhooks:** tabla `ProcessedWebhookEvent` (event id Polar UNIQUE) actualizada **atómicamente** con la tx de crédito → reenvío no re-emite.
- **Tenancy uniforme por `organizationId` (resuelve la contradicción saldo/subscription):** TODO recurso de negocio cuelga de `organizationId` — `Project`, `CreditBalance`, `CreditHold`, `CreditLedger`, `Subscription`. **Cuenta personal (B2C) = organización implícita de 1 miembro** creada al registrarse → un solo modelo de pertenencia. `Subscription` pasa a ser **por organización** (no 1:1 con User), coherente con que saldo y proyectos son de la org. `accountType` (B2B/B2C) es metadato de la org, no cambia el dueño.
- **Ownership ESTRUCTURAL, no opcional:** repos/helpers que **exigen** `OrgContext` como parámetro obligatorio; no existe ruta de acceso a recurso sin él (la API del repo no ofrece método sin scoping → no compila). No es un `assertOwnership` *opcional* que el dev puede olvidar: el scoping es la única puerta → anti-IDOR por construcción.
- **Congelar campos add-ons:** dejar `Subscription`/`VotingRoom`/`MarketplaceItem` con sus campos previstos por F8/F9/F10 ya en el schema inicial (aditivo) para no forzar migración tardía.
- **Créditos de bienvenida FINITOS por cuenta (no "gratis por proyecto"):** al registrar, la org recibe `welcome_credits` (de `SystemSetting`, NO hardcodeado) en `CreditBalance`, **una sola vez**. El "primer entregable gratis" se paga con ese saldo finito → da igual cuántos `Project` cree el usuario; agotado, se cobra normal (cierra el abuso de multiplicar proyectos). **Idempotencia derivada (sin flag nuevo):** un `CreditLedger` entry `reason="welcome_grant"` con UNIQUE parcial `(organizationId) WHERE reason='welcome_grant'` garantiza que reintento/doble-registro no re-acredita (el ledger ya es la fuente append-only de movimientos, DRY). Crédito y ledger en la **misma tx** que crea la org. **Anti-sybil:** el cupo solo es **gastable** tras verificar email (Better Auth `verification`); se registra el `origin` (IP + dominio email) y un `accounts_per_origin_limit` (`SystemSetting`) frena altas del mismo origen. **En MVP el límite se cuenta por IP** (más costosa de rotar que el dominio); el dominio email se guarda como refuerzo post-MVP. Cadena: email verificado → límite por IP → cupo finito → cap global de F8 (el gating de gasto vive en F8).

## Requirements
**Funcionales**
- Modelos: User, Project, Conversation, Message, CanvasState, AgentState, Deliverable, Iteration, Subscription, CreditLedger, ProcessedWebhookEvent, VotingRoom, Vote, Comment, MarketplaceItem, Addon.
- **Modelos admin/plataforma (consumidos por el back-office):** AuditLog, ModelConfig, BrandSettings, SystemSetting, MediaAsset, MediaFolder, UsageEvent.
  - `AuditLog(actorId, action, targetType, targetId, meta Json, createdAt)` append-only (idx createdAt/actorId); `ModelConfig(action UNIQUE, primaryModel, fallbacks String[], provider?, baseURL?, enabled)` — `provider`/`baseURL` para el fallback de gateway de F3 (valor de allowlist, no arbitrario), seed de defaults; `BrandSettings` singleton (brandName, logoAssetId, logoMobileAssetId, colors Json); `SystemSetting(key UNIQUE, value Json, enabled)` flags+límites/cuotas; `MediaAsset(folderId, key, url, mime, size, w, h, status, createdBy; idx folderId)`; `MediaFolder(name, parentId self-ref)`; `UsageEvent(userId, orgId, action, unit token|image, amount, cost, refId, createdAt; idx createdAt/action/userId)` telemetría append-only.
- Rol de plataforma `admin` declarado vía plugin `admin()` de Better Auth (distinto de `accountType` B2B/B2C).
- **Tenancy uniforme:** `Project`, `CreditBalance`, `CreditHold`, `CreditLedger` y `Subscription` con `organizationId` (índices por `organizationId`). Cuenta personal = organización implícita de 1 miembro creada al registrarse. `Subscription` es **por organización**, no 1:1 con User.
- `CreditBalance(organizationId UNIQUE, balance Int, updatedAt)`: saldo **autoritativo**, fila bloqueable (`SELECT ... FOR UPDATE`).
- `CreditLedger`: append-only **solo auditoría** (movimientos), no fuente del saldo.
- `CreditHold(idempotencyKey UNIQUE, organizationId, amount, state PENDING|SETTLED|REVERTED|EXPIRED, refType, refId, expiresAt, createdAt, updatedAt)`: idempotencyKey por OPERACIÓN; transiciones válidas explícitas (PENDING→SETTLED|REVERTED|EXPIRED; estados terminales).
- `ProcessedWebhookEvent`: dedup idempotente de webhooks Polar (event id UNIQUE).
- Campos de `Subscription`/`VotingRoom`/`MarketplaceItem` congelados en el schema inicial (previstos por F8/F9/F10, aditivo).
- Auth: 3 métodos — email+password, **email-OTP sin contraseña**, OAuth social **Google + Meta (facebook)**; todos crean org implícita (`requireEmailVerification`); sesión persistida, logout. **Turnstile** server-side antes de crear cuenta / enviar OTP en flujos email/password y email-OTP (OAuth exento). Al registrar: acreditar `welcome_credits` (de `SystemSetting`) a `CreditBalance` una vez (`CreditLedger.reason="welcome_grant"` + UNIQUE parcial, idempotente) + registrar `origin` (IP + dominio email). Social sin email verificado → completar con OTP `email-verification` antes de gastar cupo gratis. Gate de gasto del cupo (email verificado + `accounts_per_origin_limit` por IP) lo aplica F8.
- RBAC: distinguir cuenta B2B (organización multi-miembro) de B2C (org implícita de 1); gate de permisos en server.
- **Scoping estructural:** repositorio/helper `withOrg(orgContext)` que exige `OrgContext` como parámetro obligatorio; toda query de recurso pasa por él *por construcción* (no hay método de acceso sin scoping → anti-IDOR no olvidable).
- Cliente Prisma singleton (evita agotar conexiones en dev hot-reload).
- Estructura base de Server Actions y route handler de auth (`/api/auth/[...all]`).
- Endpoint `/api/health` (liveness/readiness: app + DB) — contrato consumido por F11 (CI/CD, healthcheck de despliegue).

**No funcionales**
- Migraciones reproducibles (`prisma migrate`), idempotentes.
- Conexión vía `DATABASE_URL` (secret server-side); nunca expuesta al cliente.
- Índices en FKs y campos de consulta frecuente (`projectId`, `userId`, `createdAt`).
- Tipos generados de Prisma reutilizados en contratos (no redefinir).

## Architecture
**Modelo de datos (relaciones):**
```
User 1──n Project
Project 1──n Conversation 1──n Message
Project 1──1 CanvasState (jsonb: objetos Konva + versión)
Project 1──1 AgentState (jsonb: fase actual + `Collected`; estado de la máquina de 5 fases; version p/ lock optimista)  # persistencia que consume F5
Project 1──n Deliverable (enum tipo: PLANO_2D|RENDER_3D|MEMORIA; legalSeal; version)
Deliverable 1──n Iteration (feedback por zona: zone jsonb, instruction, resultRef)
Organization 1──1 Subscription (organizationId; plan, status; ids Polar; cycle congelado p/ F8)  # por ORG, no por User
Organization 1──1 CreditBalance (organizationId UNIQUE, balance:int, updatedAt)  # saldo AUTORITATIVO, fila bloqueable (FOR UPDATE)
Organization 1──n CreditHold (idempotencyKey UNIQUE, amount:int,
                        state:PENDING|SETTLED|REVERTED|EXPIRED, refType, refId, expiresAt, createdAt, updatedAt)  # idem por OPERACIÓN
Organization 1──n CreditLedger (delta:int, reason, refId, holdId?, createdAt)  # AUDITORÍA append-only; reason="welcome_grant" + UNIQUE parcial (organizationId) → cupo bienvenida 1 vez
Organization (originEmailDomain?, originIp?)  # origen del alta → anti-sybil por origen (gate en F8)
ProcessedWebhookEvent (eventId UNIQUE, type, processedAt)  # dedup webhooks Polar
Project 1──n VotingRoom 1──n Vote ; VotingRoom 1──n Comment
Deliverable 1──n MarketplaceItem (label, affiliateUrl, vendor; campos congelados p/ F10)
Addon (registry: key, version, extensionPoints jsonb, enabled)
# TODO recurso de negocio cuelga de organizationId (tenancy uniforme; cuenta personal = org implícita de 1):
Project.organizationId / CreditBalance.organizationId / CreditHold.organizationId / CreditLedger.organizationId / Subscription.organizationId
[Better Auth] user·session·account·verification·organization·member·invitation
[Better Auth admin()] User.role (admin|user) + banned  # rol plataforma, ≠ accountType B2B/B2C

# --- Modelos admin/plataforma (back-office los consume; aquí se declaran) ---
AuditLog (actorId, action, targetType, targetId, meta jsonb, createdAt; append-only; idx createdAt/actorId)
ModelConfig (action UNIQUE: vision|chat|plano2d|render3d|inpaint|memoria; primaryModel, fallbacks[], enabled)
BrandSettings (singleton: brandName, logoAssetId→MediaAsset, logoMobileAssetId→MediaAsset, colors jsonb)
SystemSetting (key UNIQUE, value jsonb, enabled)  # feature flags + límites/cuotas
MediaFolder 1──n MediaFolder (parentId self-ref) ; MediaFolder 1──n MediaAsset
MediaAsset (folderId, key, url, mime, size, width, height, status, createdBy; idx folderId)
UsageEvent (userId, orgId, action, unit token|image, amount, cost, refId, createdAt; idx createdAt/action/userId)
```
**Estructura `src/server/` (owner BE, módulos base):**
```
src/server/
  db/prisma.ts            # singleton PrismaClient
  auth/auth.ts            # betterAuth() config (adapter, providers, org plugin)
  auth/permissions.ts     # access control B2B/B2C
  auth/org-context.ts     # OrgContext (organizationId) resuelto desde la sesión
  db/scoped-repo.ts       # withOrg(ctx): repo que EXIGE OrgContext; única puerta a queries de recurso (scoping estructural)
  billing/credit-balance-repo.ts  # débito tx con lock de fila (FOR UPDATE) sobre CreditBalance
  billing/credit-hold.ts          # máquina de estados CreditHold (hold/settle/revert/expire) + reaper
  actions/                # Server Actions base (projects, deliverables CRUD) — siempre vía withOrg
  # NO: ai/, agent/  → owner rol IA (F3/F5)
src/app/api/auth/[...all]/route.ts   # handler Better Auth (toNextJsHandler)
src/app/api/health/route.ts          # liveness/readiness (app + DB) — consumido por F11
prisma/
  schema/                 # multi-file: base.prisma, user-auth.prisma, project-canvas.prisma,
                          # billing.prisma, addons.prisma, admin.prisma (modelos plataforma)
  migrations/
```
**Data flow auth:** request → `/api/auth/[...all]` (Better Auth) → sesión cookie → Server Action lee sesión → `permissions.ts` valida rol → `org-context` resuelve `OrgContext` → `withOrg(ctx)` (scoping) → Prisma. Secrets nunca cruzan al cliente.

## Related Code Files
**Crear (owner BE):**
- `prisma/schema/base.prisma` — datasource, generator (`prismaSchemaFolder`), enums
- `prisma/schema/user-auth.prisma` — User + tablas Better Auth + org/member
- `prisma/schema/project-canvas.prisma` — Project, Conversation, Message, CanvasState, Deliverable, Iteration
- `prisma/schema/billing.prisma` — Subscription (organizationId), CreditBalance (organizationId UNIQUE, saldo autoritativo), CreditHold (idempotencyKey UNIQUE, state PENDING|SETTLED|REVERTED|EXPIRED, expiresAt), CreditLedger (auditoría append-only), ProcessedWebhookEvent
- `prisma/schema/addons.prisma` — VotingRoom, Vote, Comment, MarketplaceItem, Addon (campos congelados p/ F9/F10)
- `prisma/schema/admin.prisma` — AuditLog, ModelConfig, BrandSettings, SystemSetting, MediaAsset, MediaFolder, UsageEvent (consumidos por el back-office; aquí solo se declaran)
- `src/server/db/prisma.ts` — cliente singleton
- `src/server/auth/auth.ts` — config Better Auth + prismaAdapter + `socialProviders.google`+`.facebook` + plugins `organization()`, `admin()`, `emailOTP({sendVerificationOTP})`, `captcha({provider:"cloudflare-turnstile"})`
- `src/server/auth/send-email.ts` — interfaz `EmailSender` **enchufable** (`send({to,subject,body})`) con **Resend como impl por defecto** y SMTP conmutable (coherente con el patrón de adaptadores del proyecto, facilita self-host fair-code). Proveedor seleccionado por env; secret server-only
- `src/server/auth/permissions.ts` — accessControl + roles B2B/B2C
- `src/server/auth/org-context.ts` — resuelve `OrgContext` (organizationId) desde la sesión; crea org implícita al registrar
- `src/server/db/scoped-repo.ts` — `withOrg(orgContext)`: repo que **exige** OrgContext; única puerta a queries de recurso (scoping estructural, anti-IDOR)
- `src/server/billing/credit-balance-repo.ts` — débito con lock de fila (`FOR UPDATE`) sobre `CreditBalance` (saldo autoritativo)
- `src/server/billing/credit-hold.ts` — máquina de estados `CreditHold` + transiciones válidas (hold/settle/revert/expire) + reaper de huérfanos
- `src/server/actions/projects.ts` — Server Actions CRUD proyecto (base, vía `withOrg`)
- `src/app/api/auth/[...all]/route.ts` — route handler auth
- `src/app/api/health/route.ts` — healthcheck (app + DB) consumido por F11

**Modificar:** `.env.example` (añadir `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`, `TURNSTILE_SITE_KEY` (público) + `TURNSTILE_SECRET_KEY` (server), proveedor email enchufable `EMAIL_PROVIDER` + su credencial — `RESEND_API_KEY` por defecto, o `SMTP_*` si se conmuta) — coordinar con F0/F11.
**Sin solape:** `src/server/ai/**` y `src/server/agent/**` los crea rol IA. FE no toca `src/server/**`.

## Implementation Steps
1. Configurar `prisma/schema/base.prisma`: datasource Postgres, generator con carpeta multi-file, enums (DeliverableType, AccountType, SubscriptionStatus, AddonKey, HoldState `PENDING|SETTLED|REVERTED|EXPIRED`, ModelAction `vision|chat|plano2d|render3d|inpaint|memoria`, UsageUnit `token|image`, MediaStatus).
2. Modelar dominios en sus `.prisma` respectivos con relaciones, índices y `Json` para canvas/zona/extensionPoints. **Tenancy uniforme:** `organizationId` en Project/Subscription/CreditBalance/CreditHold/CreditLedger. `CreditBalance(organizationId UNIQUE, balance Int)` (saldo autoritativo). `CreditHold(idempotencyKey UNIQUE, state HoldState, amount, refType, refId, expiresAt)`. `CreditLedger` append-only (auditoría, `holdId?`, `reason`) **+ índice UNIQUE parcial `@@unique([organizationId]) WHERE reason='welcome_grant'`** (o constraint SQL en la migración) → garantiza un único acreditado de bienvenida por org. Campos `originEmailDomain?`/`originIp?` en Organization (origen del alta, anti-sybil). Tabla `ProcessedWebhookEvent`. Congelar campos previstos de Subscription/VotingRoom/MarketplaceItem.
2b. Modelar `admin.prisma`: AuditLog (append-only, idx createdAt/actorId), ModelConfig (action UNIQUE, fallbacks `String[]`), BrandSettings (singleton), SystemSetting (key UNIQUE), MediaFolder (parentId self-ref), MediaAsset (idx folderId), UsageEvent (idx createdAt/action/userId). Seed de defaults para ModelConfig (mapeo acción→modelo de arranque).
3. `prisma migrate dev` → generar migración inicial; verificar `jsonb` en SQL.
4. Cliente singleton en `db/prisma.ts` (patrón global en dev).
5. Better Auth: `auth.ts` con `prismaAdapter(prisma,{provider:"postgresql"})`, `emailAndPassword` (requireEmailVerification), `socialProviders:{google, facebook}` (Meta=`facebook`), `plugins:[organization({...}), admin({...}), emailOTP({sendVerificationOTP}), captcha({provider:"cloudflare-turnstile", secretKey:TURNSTILE_SECRET_KEY})]`. `sendVerificationOTP` enruta a `send-email.ts` por tipo (`sign-in`/`email-verification`/`forget-password`). El captcha nativo valida el token Turnstile **server-side antes** de crear cuenta/enviar OTP en flujos email/password y email-OTP; **OAuth queda exento** (el proveedor social es la barrera). **Hook de registro (misma tx):** crear org implícita de 1 miembro + `CreditBalance`; registrar `origin` (IP + dominio email); **acreditar `welcome_credits`** (de `SystemSetting`) al balance + `CreditLedger(reason="welcome_grant")` con UNIQUE parcial → idempotente. El plugin `admin()` añade rol plataforma `admin`/`user`. Social sin email verificado: el usuario completa OTP `email-verification` antes de que el gate de gasto (F8) permita cupo gratis.
6. `permissions.ts` + `org-context.ts`: `createAccessControl` con recursos (project, deliverable, votingRoom); roles owner/admin/member + helper B2C. `org-context.ts` resuelve `OrgContext` (organizationId activo) desde la sesión.
7. Route handler `toNextJsHandler(auth)` en `/api/auth/[...all]`.
8. **Scoping estructural** `db/scoped-repo.ts`: `withOrg(orgContext)` retorna un repo cuyas queries inyectan `organizationId` por construcción; **no** existe método de acceso a recurso sin `OrgContext` (anti-IDOR no olvidable). Usarlo en TODA Server Action de recurso.
8b. `billing/credit-balance-repo.ts` + `billing/credit-hold.ts`: débito autoritativo = tx (lock fila `CreditBalance` con `FOR UPDATE` → verificar `≥coste` → decrementar → insertar `CreditLedger`). `CreditHold` como máquina de estados: `hold()` reserva (PENDING) descontando del balance; `settle()`/`revert()` transicionan a terminal; reaplicar la misma `idempotencyKey` devuelve estado sin re-efecto. Reaper: job que pasa holds PENDING vencidos a EXPIRED y repone balance (misma tx).
9. Server Actions base de Project (crear/listar/leer) vía `withOrg`, con guard de sesión+rol.
10. `/api/health/route.ts`: chequea app + ping a DB; responde 200/503 (contrato para F11).
11. `prisma generate` y verificar tipos en contratos compartidos.

## Todo List
- [x] Schema multi-file Prisma 7 con modelos core (incl. ProcessedWebhookEvent) + 7 modelos admin (admin.prisma) + tablas Better Auth
- [x] Tenancy uniforme: `organizationId` en Project/Subscription/CreditBalance/CreditHold/CreditLedger; campos add-ons congelados
- [x] `CreditBalance` (saldo autoritativo, fila bloqueable) + `CreditHold` (máquina de estados PENDING|SETTLED|REVERTED|EXPIRED, idempotencyKey por operación, expiresAt) + `CreditLedger` auditoría append-only
- [x] AuditLog (append-only) / ModelConfig (seed defaults) / BrandSettings / SystemSetting / MediaAsset / MediaFolder / UsageEvent con índices
- [x] Migración inicial aplicada; `jsonb` verificado
- [x] Cliente Prisma singleton
- [x] Better Auth: email/password (requireEmailVerification) + email-OTP + OAuth Google+Meta + sesión; `emailOTP()` (sendVerificationOTP→send-email) + `captcha()` Turnstile (server-side, solo no-OAuth); hook que crea org implícita + CreditBalance + acredita `welcome_credits` (idempotente, UNIQUE parcial `welcome_grant`) + registra `origin`; social sin email verificado pide OTP antes de cupo gratis
- [x] Plugin organization() + admin() (rol plataforma) + access control B2B/B2C
- [x] Scoping estructural `withOrg(orgContext)` (exige OrgContext) usado en todas las Server Actions de recurso
- [x] Débito con lock de fila (`FOR UPDATE`) + máquina de estados CreditHold + reaper de holds huérfanos
- [x] Route handler `/api/auth/[...all]` + `/api/health`
- [x] Server Actions base de Project con guard de permisos + scoping
- [x] `.env.example` actualizado (coordinado con OPS)

## Success Criteria
- `prisma migrate` corre limpio; DB refleja modelos core + 7 modelos admin + tablas auth.
- Registro/login email+password, email-OTP y OAuth (Google+Meta) funcionan; sesión persiste; **registro crea org implícita + `CreditBalance` + acredita `welcome_credits` (de `SystemSetting`) una sola vez** (`CreditLedger.reason="welcome_grant"`, UNIQUE parcial → reintento no re-acredita) **+ registra `origin`**. Flujos email/password y email-OTP rechazan sin token Turnstile válido; OAuth no lo exige. Social sin email verificado no gasta cupo gratis hasta verificar por OTP.
- `CreditBalance` es la fuente del saldo (no `SUM(CreditLedger)`); débito bloquea la fila; saldo nunca negativo bajo concurrencia multi-réplica.
- `CreditHold` respeta transiciones válidas (PENDING→terminal); settle-tras-revert rechazado; reaper revierte holds PENDING vencidos.
- Server Action protegida rechaza sin sesión y respeta rol B2B/B2C; rol plataforma `admin` distinguible. Toda query de recurso pasa por `withOrg` (no hay acceso sin scoping).
- `ModelConfig` arranca con seed de defaults (mapeo acción→modelo); `AuditLog` no admite update/delete.
- `CanvasState.data` y `Iteration.zone` son `jsonb` en Postgres.
- Tipos Prisma importables desde contratos sin redefinición.

## Risk Assessment
| Riesgo | Prob×Imp | Mitigación |
|---|---|---|
| Solape tablas Better Auth vs modelos manuales | Med×Alto | No declarar tablas auth a mano; dejar que BA las gestione, solo relacionar |
| API Better Auth 1.6 (organization/admin/emailOTP/captcha) cambió | Med×Med | Usar plugins NATIVOS (no custom); confirmar exports con docs-seeker; pin de versión |
| Sybil vía OAuth social sin email verificado (Meta) | Med×Alto | Email verificado = invariante: social incompleto pide OTP `email-verification` antes de cupo gratis; gate de gasto (F8) exige verificado |
| Bot/automatización en registro no-OAuth | Med×Med | Captcha nativo Turnstile server-side antes de crear cuenta/enviar OTP (OAuth exento; el proveedor social ya es barrera) |
| Conexiones agotadas por hot-reload | Alto×Med | Singleton global de PrismaClient |
| Saldo negativo bajo concurrencia (SUM no atómico) | Med×Alto | Saldo autoritativo en `CreditBalance` con lock de fila (`FOR UPDATE`); ledger solo auditoría; test de concurrencia valida multi-réplica (no mutex de proceso) |
| Doble cobro / settle-tras-revert / doble webhook | Med×Alto | `CreditHold` como máquina de estados (idempotencyKey por OPERACIÓN; transiciones válidas explícitas; estados terminales) |
| Crédito reservado para siempre (proceso muerto entre hold y settle) | Med×Alto | `CreditHold.expiresAt` + reaper que revierte holds PENDING vencidos (PENDING→EXPIRED + repone balance) |
| Contradicción tenant (Subscription 1:1 User vs orgId en saldo) | Med×Alto | Tenancy uniforme: TODO cuelga de `organizationId`; cuenta personal = org implícita de 1; `Subscription` por organización |
| Webhook Polar reenviado re-emite créditos | Med×Alto | `ProcessedWebhookEvent` (event id UNIQUE) actualizado atómicamente con la transacción de crédito |
| IDOR: acceso a recurso de otro usuario/org | Med×Alto | Scoping **estructural** `withOrg(orgContext)`: el repo exige `OrgContext`; no existe ruta de acceso sin scoping (no olvidable por construcción) |
| Migración tardía por campos de add-ons | Med×Med | Congelar campos previstos de Subscription/VotingRoom/MarketplaceItem en schema inicial (aditivo) |
| Migración Json no mapea a jsonb | Bajo×Med | Verificar SQL generado en paso 3 |
| Doble acreditado de bienvenida / "gratis por proyecto" infinito | Med×Alto | UNIQUE parcial `(organizationId) WHERE reason='welcome_grant'` + acreditado en la tx que crea la org; el gratis es saldo finito por cuenta, no por proyecto → crear proyectos no re-acredita |

## Security Considerations
- `BETTER_AUTH_SECRET`, `DATABASE_URL`, OAuth secrets (Google/Meta), `TURNSTILE_SECRET_KEY`, key del proveedor de email solo server-side. `TURNSTILE_SITE_KEY` es público (cliente). Captcha (no-OAuth) + email verificado son barreras anti-sybil/anti-bot antes de gastar cupo gratis.
- Toda Server Action valida sesión + permiso antes de tocar DB.
- B2B/B2C aisla datos por organización: scoping **estructural** vía `withOrg(orgContext)` en toda query de recurso — el repo exige `OrgContext`, no hay ruta de acceso sin él (nunca confiar en id del cliente → anti-IDOR por construcción).
- Hash de password gestionado por Better Auth (no manual).
- CreditLedger inmutable → auditoría de débitos por IA (consumido por F8). `AuditLog` append-only → traza fiable de acciones admin destructivas (no falsificable por update/delete).
- `ModelConfig`/`SystemSetting` NO almacenan API keys de proveedores (solo nombres de modelo/flags); las keys siguen solo en `process.env` server-side.

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor), integration/Vitest contra **Postgres de test efímero** (no mock de Prisma):
- **CreditHold máquina de estados / idempotencia por operación**: reaplicar la misma `idempotencyKey` no re-efecta (devuelve estado); doble `settle` no duplica débito; `revert` libera; **`settle` tras `revert` se rechaza** (terminal); operaciones distintas (iteración vs regeneración vs webhook) usan claves distintas. Rojo sin la máquina de estados.
- **Saldo autoritativo no negativo bajo concurrencia multi-réplica**: dos `hold` concurrentes sobre `CreditBalance` justo → uno falla; el saldo nunca baja de 0. El test simula **dos conexiones/transacciones** (no un mutex de proceso) → valida el lock de fila `FOR UPDATE`. Rojo sin lock.
- **Reaper de holds huérfanos**: un hold PENDING con `expiresAt` vencido → el reaper lo pasa a EXPIRED y **repone el balance**; no toca holds vigentes ni terminales. Rojo sin reaper.
- **Tenancy + bienvenida UNA sola vez (N proyectos no dan gratis infinito)**: registrar crea org implícita + `CreditBalance(welcome_credits de SystemSetting)` (`Subscription`/`CreditBalance` cuelgan de `organizationId`) + un `CreditLedger(reason="welcome_grant")`; reejecutar el hook o crear varios `Project` NO re-acredita (UNIQUE parcial → segundo insert falla; el cupo es por cuenta, no por proyecto). Registra `originEmailDomain`/`originIp` (consultable por F8; el gate de gasto vive en F8). Rojo sin el constraint.
- **Scoping estructural/IDOR**: el repo `withOrg(orgA)` no devuelve recursos de `orgB`; **no existe** un método de acceso a recurso que omita `OrgContext` (verificado por la firma/tipos del repo). Verde con `withOrg`.
- **Dedup webhook**: insertar dos veces el mismo `ProcessedWebhookEvent` (eventId) en la misma tx que el crédito → segundo insert falla, crédito no se re-emite.
- **Auth**: Server Action sin sesión rechaza; con sesión respeta rol B2B/B2C; rol plataforma `admin` se distingue de `user`.
- **Auth 3 métodos + Turnstile + email verificado**: registro email/password y email-OTP **rechazados sin token Turnstile válido**; OAuth NO requiere Turnstile; email-OTP inicia sesión con código válido y **rechaza código expirado/incorrecto**; social sin email verificado **no puede gastar cupo gratis** hasta verificar por OTP `email-verification`.
- **AuditLog inmutable**: insertar registro OK; intento de `update`/`delete` rechazado (append-only) → garantiza traza fiable de acciones admin.
- **ModelConfig**: `action` UNIQUE impide duplicar acción; seed de defaults presente tras migrar; lectura por acción devuelve `{primaryModel, fallbacks, enabled}`.
- **Mock:** se mockean los servicios externos — OAuth (Google/Meta), verificación Turnstile y envío de email (OTP). NO se mockea Prisma ni Postgres (DB real de test valida migraciones y `jsonb`).

## Next Steps
- F5 (IA agente) persiste Conversation/Message/CanvasState vía estos modelos.
- F8 (créditos+Polar) implementa hold/settle/revert sobre `CreditBalance`/`CreditHold` (no redefine tablas), extiende Subscription y añade webhooks.
- F9/F10 (add-ons) usan VotingRoom/Vote/Comment/MarketplaceItem/Addon.
- F4 (FE canvas) consume Server Actions de Project + serializa a CanvasState.
- El back-office (shell/usuarios, config IA/branding, media, analítica) consume estos modelos y el plugin `admin()`; no edita `prisma/**`. F3 lee `ModelConfig`; F17 escribe `MediaAsset`/`MediaFolder`; F3/F8 emiten `UsageEvent`; toda acción admin destructiva escribe `AuditLog`.
