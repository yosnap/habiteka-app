# F15 — Admin Shell & Gestión de Usuarios (Rol FE+BE)

## Context Links
- Plan general: [plan.md](plan.md) · Arquitectura: [docs/system-architecture.md](../../docs/system-architecture.md)
- Auth/usuarios/RBAC base: [phase-02](phase-02-be-datos-auth.md) (Better Auth, `scoped-repo.ts`/`withOrg`, `permissions.ts`)

## Overview
- **Rol primario:** FE+BE (back-office)
- **Prioridad:** P1 (puerta de entrada al dashboard admin)
- **Estado:** Completado (PR #16)
- **Depende de:** F2 (auth, modelo `User`, `permissions.ts`, organization plugin)
- **Paralela con:** F16, F17, F18 (todas comparten árbol `(admin)` pero subrutas distintas)
- **Descripción:** Shell del back-office: layout, navegación lateral, **guardia de ruta solo-admin** (server-side), y CRUD de gestión de **usuarios** (listar, ver, editar, suspender, gestionar accesos/roles). Define el rol **admin** distinto de B2B/B2C vía Better Auth. NO toca el FE de usuario `src/app/(app)/**` (F4/F6).

## Key Insights
- **Rol admin ≠ B2B/B2C:** el `admin` es un rol de plataforma. Better Auth 1.6 ofrece el plugin `admin()` (roles a nivel app: `admin`/`user`, más `ban`/`impersonate`/`listUsers`). Reusarlo (DRY) en vez de construir RBAC propio. Coordinar con F2: el plugin se añade en `auth.ts` (owner F2); el admin solo lo **consume**.
- **Guardia server-side obligatoria:** el `(admin)` layout valida sesión + rol admin en el servidor (RSC/`layout.tsx`) antes de renderizar; nunca confiar en ocultar links en cliente. Toda Server Action admin revalida rol (defensa en profundidad).
- **Suspender ≠ borrar:** suspender = `banned=true` (Better Auth admin plugin invalida sesiones). Borrado duro es destructivo → fuera de MVP; si se ofrece, auditado y con confirmación.
- **Acción destructiva = auditada:** suspender/cambiar rol/forzar logout escriben `AuditLog` (modelo propuesto a F2, ver F18).
- **Segmentos de ruta separados** evitan colisión: cada fase admin posee su subcarpeta bajo `(admin)/`; el layout/nav compartido lo posee F15 (esta fase).

## Requirements
**Funcionales**
- Layout `(admin)` con nav lateral (Usuarios, Config, Media, Analítica/Facturación) + topbar (sesión, logout).
- Guardia de acceso: solo `role=admin`; usuario no-admin → 403/redirect.
- Usuarios: listar (paginado, búsqueda por email/nombre, filtro por rol/estado), ver detalle, editar (nombre, rol, accountType), suspender/reactivar (ban/unban), forzar logout (revocar sesiones).
- Gestión de accesos/roles: asignar/quitar rol admin; ver organizaciones/membresías del usuario (solo lectura del lado B2B).
- Toda mutación pasa por Server Action con guard de rol admin + escritura de `AuditLog`.

**No funcionales**
- Paginación server-side (no cargar todos los usuarios).
- Archivos ≤200 líneas; tabla/filtros como componentes shadcn reutilizables.
- Sin estado global mutable por request en helpers de guard.

## Architecture
```
src/app/(admin)/
  layout.tsx                 # guardia server-side rol admin + shell/nav
  users/page.tsx             # tabla usuarios (RSC) + filtros
  users/[id]/page.tsx        # detalle + acciones
src/components/admin/
  admin-shell.tsx, admin-nav.tsx, user-table.tsx, user-detail.tsx, role-badge.tsx
src/server/admin/
  guard.ts                   # requireAdmin(): valida sesión + role=admin (server)
  users/actions.ts           # listUsers/getUser/updateUser/setRole/banUser/unbanUser/revokeSessions
  audit.ts                   # helper writeAudit() → AuditLog (modelo de F2)
```
**Data flow:** request → `(admin)/layout.tsx` llama `requireAdmin()` → si no admin, 403 → RSC renderiza shell → acción de usuario invoca Server Action → `requireAdmin()` revalida → Better Auth admin API (ban/setRole/listUsers) o Prisma → `writeAudit()` → revalidate.

## Related Code Files
**Crear (owner F15):**
- `src/app/(admin)/layout.tsx`, `src/app/(admin)/users/page.tsx`, `src/app/(admin)/users/[id]/page.tsx`
- `src/components/admin/{admin-shell,admin-nav,user-table,user-detail,role-badge}.tsx`
- `src/server/admin/guard.ts` — `requireAdmin()` (reutilizado por F16/F17/F18)
- `src/server/admin/users/actions.ts`
- `src/server/admin/audit.ts` — `writeAudit()` (reutilizado por todas las fases admin)

**Lee (no edita):** `src/server/auth/**` (F2: `auth`, `permissions`), tipos Prisma `User`.
**Requiere de F2 (coordinar):** plugin `admin()` en `auth.ts`; modelo `AuditLog` (ver F18). El admin NO edita `prisma/**` ni `src/server/auth/**`.
**Sin solape:** NO toca `src/app/(app)/**`, `src/components/**` (raíz, FE usuario), `src/server/{ai,agent,db,billing}/**`.

## Implementation Steps
1. Coordinar con F2: añadir plugin `admin()` de Better Auth en `auth.ts` y rol `admin` (F2 owner). Admin solo consume su API.
2. `src/server/admin/guard.ts`: `requireAdmin()` lee sesión server, verifica `role==='admin'`; lanza/redirect 403 si no.
3. `(admin)/layout.tsx`: invoca `requireAdmin()`; renderiza `admin-shell` + `admin-nav`.
4. `users/actions.ts`: Server Actions que revalidan `requireAdmin()` y delegan en Better Auth admin API (`listUsers`, `setRole`, `banUser`, `unbanUser`, `revokeSessions`) + `updateUser` vía Prisma.
5. `audit.ts`: `writeAudit({actorId, action, targetType, targetId, meta})` → `AuditLog`.
6. UI: `user-table` (paginado/filtros), `user-detail` con botones de acción (confirm dialogs en destructivas).
7. `bun run typecheck` + `bun run build` verdes.

## Todo List
- [x] Plugin `admin()` consumido (de F2; rol leído de la sesión)
- [x] `requireAdmin()` server-side guard (revalidado en cada Server Action)
- [x] `(admin)/layout.tsx` con shell + nav + guardia (redirect si no admin)
- [x] Lista de usuarios paginada con filtros (email/estado, server-side)
- [x] Detalle de usuario + acciones
- [x] Suspender/reactivar (ban/unban) + forzar logout (invalida sesiones)
- [x] Asignar/quitar rol admin (con guard "no auto-degradarse")
- [x] `writeAudit()` en toda mutación destructiva (AuditLog append-only)
- [x] Tests TDD rojo→verde (ops, no-self-action, auditoría inmutable, paginación)

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor):
- **Guardia admin (integration, Postgres efímero):** request a ruta `(admin)` sin rol admin → 403; con rol admin → pasa. Server Action admin invocada por no-admin → rechaza. Rojo sin `requireAdmin()`.
- **Suspender invalida sesión:** `banUser` marca `banned` y revoca sesiones; el usuario suspendido no puede autenticar. Verde con Better Auth admin API.
- **Auditoría de acción destructiva:** `setRole`/`banUser` escriben un `AuditLog` con actor+target+action. Rojo sin `writeAudit()`.
- **Paginación/filtro:** `listUsers` respeta page size y filtro por email/estado (no devuelve todo).
- **Mock:** se mockea OAuth de Google. NO se mockea Prisma/Postgres (DB real de test).

## Success Criteria
- Usuario no-admin nunca ve ni ejecuta nada de `(admin)` (verificado server-side en test).
- Listar/ver/editar/suspender/rol funcionan y persisten.
- Suspender invalida sesiones del usuario afectado.
- Cada acción destructiva deja registro en `AuditLog`.

## Risk Assessment
| Riesgo | Prob×Imp | Mitigación |
|---|---|---|
| Guardia solo en cliente → escalada de privilegios | Med×Crítico | `requireAdmin()` server-side en layout **y** en cada Server Action (defensa en profundidad) |
| Plugin `admin()` de Better Auth cambió API | Med×Med | Confirmar con docs-seeker; coordinar versión con F2 antes de codear |
| Admin se auto-suspende/quita su propio rol | Baja×Med | Guard: impedir que el actor se banee/degrade a sí mismo |
| Solape de árbol `(admin)` con otras fases | Baja×Med | F15 posee solo `layout`+`users`+shell/nav; subrutas de F16/17/18 separadas |

## Security Considerations
- Toda ruta y acción admin protegida por `requireAdmin()` server-side.
- Acciones destructivas (ban, rol, revoke) auditadas con actor+timestamp.
- No exponer secrets ni datos de otros usuarios fuera del scope admin.
- Comentarios/nombres NO referencian nº de fase: explican el porqué (p.ej. "guardia server-side previene escalada de privilegios"), no el origen del plan.

## Next Steps
- F16/F17/F18 reutilizan `requireAdmin()` y `writeAudit()` y montan sus subrutas bajo `(admin)/`.
- F2 incorpora plugin `admin()` y modelo `AuditLog`.
