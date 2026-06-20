# Plan de Implementación — Habiteka MVP (Equipo de Desarrollo)

> Plan por **roles** con propiedad de archivos y grafo de dependencias (modo paralelo).
> Arquitectura aprobada: ver [docs/system-architecture.md](../../docs/system-architecture.md).
> **Alcance:** MVP completo de las 5 fases del agente, **render 3D incluido**, add-ons (votación + marketplace), créditos + Polar.
> **Estado:** Planificado — sin implementar.

## Roles del equipo

| Rol | Responsabilidad | Owner de (globs) |
|---|---|---|
| **ARQ** Arquitectura/Tech Lead | Setup repo, contratos, interfaces, registry, licencia, RGPD, **legal/ToS**, **integración e2e** | `package.json`, `tsconfig.json`, `src/lib/contracts/**`, `src/lib/addons/registry/**`, `src/lib/licensing/**`, `docs/legal/*.md` (privacy raíz, F14), `src/server/privacy/**`, **`docs/legal/tos/**` (F19)**, **`src/server/legal/**` (F19)**, **`tests/integration/e2e-flow/**` (F-INT)** |
| **BE** Backend | Prisma/Postgres, Server Actions, auth, scoping, health, **back-office BE + storage** | `prisma/**`, `src/server/{db,auth,actions,billing}/**`, `src/server/admin/**`, `src/server/storage/**`, `src/app/api/{auth,health,webhooks/polar,billing,admin}/**` |
| **FE** Frontend | Canvas Konva, chat, entregables, UI add-ons, **shell back-office**, **banner legal/cookies** | `src/app/(app)/**`, `src/app/(admin)/**`, `src/components/**` (incl. **`src/components/legal/**`**), `src/components/admin/**`, `src/canvas/**` |
| **IA** IA Engineer | Adaptadores OpenRouter+imagen (config modelos vía BD), prompts, state machine 5 fases, **spike calidad** | `src/server/ai/**`, `src/server/agent/**`, **`docs/spikes/**`**, **`tests/spikes/**`** |
| **UX** Diseño/UX | Flujos, wireframes, design system, disclaimers legales | `docs/ux/**`, `src/styles/**`, tokens shadcn |
| **QA** Testing | Unit/integration/e2e/visual, fixtures | `tests/**`, `*.test.ts`, `playwright/**` |
| **OPS** DevOps | CI/CD, Docker, secrets, despliegue, observabilidad | `.github/**`, `Dockerfile`, `infra/**` |

## Grafo de dependencias (qué corre en paralelo)

```
F0 (ARQ setup + 11 contratos) ─┬─> F1 (UX design system) ──┐
   [contract freeze gate]      ├─> F2 (BE data+auth+health) ┼─> F4 (FE canvas) ──┐
                               └─> F3 (IA adaptadores) ──────┼─> F5 (IA agente 5 fases) ─┐
                                                             │                            │
F0,F3 ──> F-S0 (SPIKE calidad IA: render/plano/visión)  [GATE GO/NO-GO · decide §9.1 · M2 no arranca sin GO]
                                                             │                            │
F4,F5 ──> F6 (FE chat+entregables UI) <──────────────────────┴── F5 ─────────────────────┤
F3,F5,F6 ──> F7 (feedback por zona / render 3D + inpaint)  [todo en src/server/agent/feedback/**]
F2,F6 ──> F8 (BE créditos hold/settle + Polar pagos)                                      │
F5,F6,F7,F8 ──> F-INT (integración end-to-end: flujo vivo sin mocks)  [cierra M2→M3 · dueño del ensamblaje]
F4,F6 ──> F9 (FE+BE add-on votación)                                                      │
F4,F6 ──> F10 (FE+BE add-on marketplace)                                                  │
F0 ──> F11 (OPS CI/CD + despliegue, consume /api/health)  [arranca temprano, en paralelo] │
F2 ──> F14 (ARQ/Legal+BE RGPD/privacidad)  [bloqueante de lanzamiento UE]                 │
F14 ──> F19 (ARQ/Legal+BE+FE ToS/EULA + cookies + DPIA)  [bloqueante UE, junto a F14]     │
TODAS ──> F12 (QA suite completa)  [QA acompaña cada fase + barrido final]────────────────┘
F3,F8 ──> F13 (ARQ licencia fair-code: control LEGAL+OPERATIVO)

# --- Back-office (admin) ---  todo bajo (admin)/** + src/server/{admin,storage}/**, sin solapar (app)/**
F2 ──────────> F15 (admin shell + usuarios; declara guard requireAdmin + writeAudit)
F2,F3 ───────> F16 (admin config modelos→BD + branding + flags; F3 lee ModelConfig vía loader)
F2,F0 ───────> F17 (admin media manager + StorageAdapter/MinIO)
F2,F3,F8 ────> F18 (admin analítica/facturación/auditoría; read-only sobre F2/F3/F8)
F15 ─provee─> F16,F17,F18 (reusan requireAdmin/writeAudit/shell)
```

**Paralelizable tras F0:** F1, F2, F3, F11 simultáneas. **Cuello de botella:** F5 (agente) depende de F2+F3.
**F7 sin solape:** toda su lógica (mask-builder/directed-inpaint incluidos) vive en `src/server/agent/feedback/**` + `src/app/api/iterations/**`; consume `ImageAdapter.inpaint` de F3 vía interfaz, NO edita `src/server/ai/**`.

## Fases

| # | Fase | Rol primario | Depende de | Paralela con | Estado | Detalle |
|---|---|---|---|---|---|---|
| F0 | Setup & 11 contratos (freeze gate) | ARQ | — | — | ✅ #6 | [phase-00](phase-00-arq-setup-contratos.md) |
| F1 | Design system & UX | UX | F0 | F2,F3,F11 | ✅ #10 | [phase-01](phase-01-ux-design-system.md) |
| F2 | Datos, auth, scoping & /api/health | BE | F0 | F1,F3,F11 | ✅ #8 | [phase-02](phase-02-be-datos-auth.md) |
| F3 | Adaptadores IA (OpenRouter+imagen) | IA | F0 | F1,F2,F11 | ✅ #9 | [phase-03](phase-03-ia-adaptadores.md) |
| **F-S0** | **Spike calidad IA (GATE GO/NO-GO, decide §9.1)** | **IA+Producto** | **F0,F3** | **—** | ⬜ | [phase-spike](phase-spike-validacion-calidad-ia.md) |
| F4 | Canvas (Konva) | FE | F1,F2 | F5 | ✅ #11 | [phase-04](phase-04-fe-canvas-konva.md) |
| F5 | Agente intérprete (5 fases) | IA | F2,F3 | F4 | ✅ #12 | [phase-05](phase-05-ia-agente-state-machine.md) |
| F6 | UI chat + entregables | FE | F4,F5 | F8 | ✅ #13 | [phase-06](phase-06-fe-chat-entregables.md) |
| F7 | Feedback por zona + render 3D/inpaint | IA+BE | F3,F5,F6 | F9,F10 | ✅ #14 | [phase-07](phase-07-feedback-render-3d.md) |
| F8 | Créditos hold/settle & pagos (Polar) | BE | F2,F6 | F7 | ✅ #15 | [phase-08](phase-08-be-creditos-pagos.md) |
| **F-INT** | **Integración end-to-end (flujo vivo, sin mocks)** | **Tech Lead/Fullstack** | **F5,F6,F7,F8** | **—** | ⬜ | [phase-int](phase-integracion-e2e.md) |
| F9 | Add-on Votación comunitaria | FE+BE | F4,F6 | F10 | ✅ #20 | [phase-09](phase-09-addon-votacion.md) |
| F10 | Add-on Marketplace | FE+BE | F4,F6 | F9 | ⬜ | [phase-10](phase-10-addon-marketplace.md) |
| F11 | DevOps: CI/CD & despliegue | OPS | F0 | casi todas | ✅ #7 | [phase-11](phase-11-ops-cicd-despliegue.md) |
| F12 | QA: suite de pruebas | QA | todas | continua | ⬜ | [phase-12](phase-12-qa-testing.md) |
| F13 | Licencia fair-code (legal+operativo) | ARQ | F3,F8 | F14 | ⬜ | [phase-13](phase-13-arq-licencia-control.md) |
| F14 | RGPD & privacidad (bloqueante UE) | ARQ/Legal+BE | F2 | F8,F9,F10,F13 | ⬜ | [phase-14](phase-14-rgpd-privacidad.md) |
| **F19** | **Legal: ToS/EULA + cookies + DPIA (bloqueante UE)** | **ARQ/Legal+BE+FE** | **F14** | **F14** | ⬜ | [phase-legal](phase-legal-tos-cookies-dpia.md) |
| F15 | Admin: shell + gestión de usuarios | FE+BE | F2 | F16,F17,F18 | ✅ #16 | [phase-15](phase-15-admin-shell-usuarios.md) |
| F16 | Admin: config modelos (BD) + branding + flags + productos Polar | BE+FE | F2,F3,F15 | F17,F18 | ✅ #17 | [phase-16](phase-16-admin-config-modelos-branding.md) |
| F17 | Admin: media manager + StorageAdapter (MinIO) | BE+FE | F2,F0,F15 | F16,F18 | ✅ #18 | [phase-17](phase-17-admin-media-manager.md) |
| F18 | Admin: analítica, facturación & auditoría | BE+FE | F2,F3,F8,F15 | F16,F17 | ✅ #19 | [phase-18](phase-18-admin-analitica-facturacion-logs.md) |

## Dependencias clave externas

- OpenRouter (chat+visión) · proveedor de imagen (FLUX/Nano Banana/Imagen) · Polar.sh · PostgreSQL · MinIO/S3 (storage) · Cloudflare Turnstile (CAPTCHA) · proveedor de email (Resend/SMTP, OTP+verificación) · OAuth Google + Meta.
- **Auth (3 métodos, Better Auth 1.6 nativo):** email+password, email-OTP sin contraseña, OAuth social Google+Meta. **Turnstile como CAPTCHA solo en flujos no-OAuth** (OAuth exento); email verificado es invariante anti-sybil antes de gastar cupo gratis.
- Secrets server-side: `OPENROUTER_API_KEY`, `IMAGE_PROVIDER_KEY`, `POLAR_*`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` (Meta), `TURNSTILE_SECRET_KEY`, email enchufable (`EMAIL_PROVIDER` + `RESEND_API_KEY` por defecto o `SMTP_*`), `STORAGE_*` (MinIO/S3). Público (cliente): `TURNSTILE_SITE_KEY`.

## Estrategia de ramas (branching avanzado)

> Flujo definido por el **team lead** (el usuario). Se apoya en el skill **`branching-avanzado`** y en la propiedad de archivos por rol (globs disjuntos minimizan conflictos de merge).

- **Rama por tarea/feature:** cada desarrollador/miembro trabaja en su propia rama por tarea, no en una rama de larga vida compartida. Convención: `feat/<rol>/<tarea>` (p.ej. `feat/be/credit-hold-state-machine`, `feat/ia/agente-cualificacion`). Coherente con **worktree por rol**: cada rol en su worktree, su rama, sus globs.
- **PR de tarea → `develop`:** la rama de tarea se integra mediante **Pull Request hacia `develop`**. **Solo el team lead revisa y acepta** esos PR (gate humano único). Nadie mergea su propio PR a `develop`.
- **`develop` → `main` en versiones MENORES:** `main` está **bloqueada** (branch protection). El paso de `develop` a `main` ocurre **por hito entregable** (versión menor) y **solo el team lead** acepta y ejecuta ese merge. Ningún push directo a `main`.
- **Versionado SEMÁNTICO ligado a fases/hitos:** **menor** por cada hito entregable (M1, M2, M-INT, M3, M4…); **parche** por fixes. **Tags/releases en `main`** marcan cada versión.
- **CI obligatorio (F11):** la pipeline de CI corre en **cada PR a `develop`**; **build verde es requisito** para que el team lead pueda aceptar el merge (no se mergea en rojo). El job de **sandbox** (F-INT, nightly/staging) corre **fuera** del PR-gate.
- **Serializador de migraciones:** `prisma/migrations/**` es serial por naturaleza (numeración/orden). Aunque los globs por rol aíslan el resto, las migraciones se integran en **un único turno de merge** (el owner BE serializa) para evitar choques de numeración entre F2/F8/F17.

## Hitos (lanzamiento incremental — todas las fases se mantienen)

> El usuario decidió **MVP completo** (5 fases del agente, render 3D, add-ons, créditos). Los hitos permiten avanzar y validar por capas SIN cortar alcance.

- **M1 — Cimientos:** F0 (11 contratos) + F1 + F2 (datos/auth/scoping/health) + F3 + F11. Salida: repo, contratos escritos, datos+auth, adaptadores IA, CI/CD.
- **🔒 Contract freeze gate (entre M1 y M2):** los 11 contratos de F0 se **congelan**. Ninguna fase de M2 arranca antes; cambios posteriores solo vía PR revisado por ARQ + aviso al equipo (evita rotura en cascada).
- **M1.5 — Contract-validation gate:** test/compilación que verifica que F2/F3/F4 importan y satisfacen los contratos congelados (typecheck verde end-to-end de las interfaces). Puerta de entrada a M2.
- **🚦 M0 — Gate de calidad IA (entre M1 y M2):** **F-S0** (spike) valida con 15-20 muestras reales que el render 3D / plano 2D / detección de visión es suficiente para que un usuario pague, y **decide el proveedor de imagen (§9.1)**. Es un **GATE GO/NO-GO**: si NO pasa, **M2 no arranca** (no se construyen 18 fases sobre una apuesta no validada). Depende de F0+F3 (adaptadores mínimos conmutables).
- **M2 — Flujo core:** F4 (canvas) + F5 (agente) + F6 (chat/entregables) + F7 (feedback/render 3D). Salida: flujo de las 5 fases funcionando. **`DebitService` pasa de stub (F0) a implementación mínima REAL** aquí (misma semántica de error/gating que F8 endurecerá en M3), para que F5/F7 codifiquen contra comportamiento, no solo firma.
- **🔗 M-INT — Integración end-to-end (cierre de M2 → M3):** **F-INT** cablea el flujo VIVO sin mocks (ingesta→cualificación→entrega→feedback con `DebitService` real + adaptadores contra sandbox). Es el **dueño del ensamblaje**: detecta desajustes de contrato (`AgentStreamEvent`, máscara `InpaintRequest`, coste→crédito) que los mocks ocultan. Puerta de entrada a M3. Depende de F5,F6,F7,F8.
- **M2.5 — Back-office base:** F15 (admin shell + gestión de usuarios; declara `requireAdmin`/`writeAudit`/rol admin). Arranca tras F2; entra pronto porque desbloquea pruebas operativas (suspender usuarios, ver datos) y provee la base que reusan F16/F17/F18. Corre en paralelo con M2/M3.
- **M3 — Negocio + add-ons + admin:** F8 (créditos/pagos) + F9 (votación) + F10 (marketplace) + F13 (licencia) + **F16** (config modelos en BD + branding + flags) + **F17** (media manager + StorageAdapter/MinIO). Salida: negocio operativo y back-office para operar la plataforma sin redeploy.
- **M4 — Analítica + hardening + cumplimiento:** **F18** (analítica/facturación/auditoría — depende de F8) + F12 (QA suite) + F14 (RGPD) + **F19** (ToS/EULA + banner de cookies + DPIA art. 35). **F14 y F19 son conjuntamente bloqueantes de lanzamiento UE.**

## Notas

- **Segmento primario MVP = B2C** (cliente final / inquilino, no técnico): flujo, tono y onboarding se optimizan para B2C; el disclaimer "conceptual" se presenta para **generar confianza, no miedo** (F1). El **B2B se añade DESPUÉS (post-MVP)**: el modelo de datos ya soporta multi-tenant (`organizationId` intacto, sin recortes), pero la **experiencia/onboarding comercial B2B y el flujo de venta de licencia comercial son post-MVP** (F13). En el MVP, F13 queda solo como licencia fair-code + control operativo (capa técnica/legal), no venta B2B.
- **Modelo de pricing = créditos + PRIMER RESULTADO GRATIS + GARANTÍA** (decisión de negocio, F8): (a) el **primer entregable** de una organización no consume créditos (onboarding gratis); (b) **garantía en feedback iterativo** — las **primeras `N` iteraciones** de un mismo entregable no se cobran ("si no te gusta, no se cobra"). Mecanismo sobre el patrón hold/settle existente: **hold de 0 / revert automático** mientras dure el cupo gratis; se cobra solo al agotarlo. `N` configurable en `SystemSetting`; **sin schema nuevo** (se deriva de `Iteration`/`CreditLedger` que F2 ya modela). El preview de coste de F6 marca **GRATIS** vs "~N créditos".
- **Proveedor de imagen = decisión por SPIKE comparativo (F-S0), no fijado a priori:** FLUX vs Nano Banana vs Imagen se comparan de igual a igual por **realismo del render 3D, precisión del plano 2D, calidad del inpainting (feedback por zona)** Y **coste por imagen**; el spike produce una **decisión go/no-go documentada + proveedor elegido** (cierra §9.1). El adaptador F3 queda conmutable por `IMAGE_PROVIDER` hasta el veredicto.
- **Plan test-first (TDD):** cada fase define sus pruebas ANTES del código en su sección "TDD / Pruebas primero" (rojo→verde→refactor). **F12 es la estrategia transversal** (pirámide, convención de nombres/ubicación, política de mocks de servicios externos, gates de cobertura por hito, DoD test-first, cableado CI). Ninguna fase se considera hecha sin sus tests rojos→verdes.
- **Mocks:** OpenRouter/proveedor de imagen/Polar se mockean con fixtures deterministas — **cero llamadas reales a IA/pagos en CI**. La lógica propia (state machine, ledger, guards, sanitizer, licencia) NO se mockea; Postgres es DB real efímera.
- **Gates de cobertura** (definidos en F12) alineados con los hitos: M1 contratos+datos, M2 flujo core, M3 negocio+add-ons, M4 hardening+cumplimiento (gate de release).
- Render 3D y feedback por zona (inpainting) están en MVP (decisión usuario).
- **Contract freeze gate** antes de M2: contratos de F0 congelados; cambios solo vía PR de ARQ.
- **F7** no toca `src/server/ai/**` (F3): toda su lógica en `src/server/agent/feedback/**` + `src/app/api/iterations/**`.
- **F14 (RGPD)** y **F19 (ToS/EULA + cookies + DPIA)** son **conjuntamente** bloqueantes para exponer el servicio a usuarios de la UE. F14 cubre privacidad (privacy/DPA/RAT/retención/supresión/minimización); F19 cubre el instrumento jurídico de responsabilidad (ToS/EULA), el consentimiento ePrivacy (banner de cookies) y la DPIA art. 35. **Globs disjuntos:** F14 = `docs/legal/**` (privacy) + `src/server/privacy/**`; F19 = `docs/legal/tos/**` + `src/components/legal/**` + `src/server/legal/**`.
- **🚦 Gate de calidad (F-S0):** spike GO/NO-GO **antes de M2** — valida que el render/plano/visión es suficiente para pagar y **decide el proveedor de imagen (§9.1)**. Si NO pasa, M2 no arranca. Owner IA+Producto (`docs/spikes/**`, `tests/spikes/**`).
- **🔗 Integración end-to-end (F-INT):** hito de **ensamblaje del flujo vivo sin mocks** (cierre M2→M3); dueño único del cableado real (`tests/integration/e2e-flow/**`). Detecta desajustes de contrato que los mocks ocultan; los reporta al owner de cada fase (no edita producción salvo wiring documentado).
- **`DebitService`:** pasa de **stub (F0) a implementación mínima REAL en M2** (no stub eterno) con la misma semántica de error/gating que F8 endurece en M3 → F5/F7 codifican contra comportamiento, no solo firma.
- **Branching:** rama por tarea `feat/<rol>/<tarea>` → PR a `develop` (solo el **team lead** acepta) → `develop`→`main` por hito (versión menor, `main` bloqueada, solo team lead); versionado semántico ligado a hitos; CI verde requerido para merge a `develop` (F11). Ver sección **Estrategia de ramas**.
- **Back-office separado:** todo el panel vive en `src/app/(admin)/**` + `src/components/admin/**` + `src/server/admin/**`, aislado de la app de usuario `src/app/(app)/**` (sin solape de ficheros). Guardia server-side `requireAdmin()` (rol plataforma `admin` vía Better Auth `admin()`, distinto de B2B/B2C) en layout y en cada Server Action.
- **Config dinámica en BD:** el mapeo acción→modelo de OpenRouter es **dato editable** en `ModelConfig` (no hardcode); F3 lo lee en runtime vía `model-config-loader` (caché + `invalidate()`, default seguro si vacío) y el panel de config lo edita → cambiar de modelo sin redeploy. Branding y flags igual (`BrandSettings`/`SystemSetting`).
- **Storage:** los assets de media se guardan en **MinIO** (S3-compatible) tras un `StorageAdapter` en `src/server/storage/**` (mismo patrón que los adaptadores IA); claves `MINIO_*` solo server-side, presigned URLs al cliente con expiración corta.
- **Modelos admin los declara F2** (`prisma/**`): `AuditLog`, `ModelConfig`, `BrandSettings`, `SystemSetting`, `MediaAsset`, `MediaFolder`, `UsageEvent`. F15-F18 los consumen pero **no** editan `prisma/**`.
- Regla: comentarios/código no referencian nº de fase (F5…) — explicar el *porqué*, no el origen del plan.
