# Organización de Ramas por Rol — Habiteka

> Guía operativa del equipo para el flujo de branching avanzado. Complementa la sección "Estrategia de ramas" del [plan](../plans/260616-2004-habiteka-mvp-equipo/plan.md).
> **Team Lead:** @yosnap (único que revisa/acepta PR a `develop` y mergea `develop`→`main`).

## 1. Flujo en una frase

```
feat/<rol>/<tarea>  ──PR──►  develop  ──(por hito, versión menor)──►  main
   (cada dev)         (revisa team lead)         (solo team lead, main bloqueada)
```

- `main` y `develop` están **protegidas** (PR + 1 review, sin force-push, sin deletion).
- Nadie mergea su propio PR. Nadie hace push directo a `develop` ni a `main`.
- CI (F11) debe estar **verde** para que el team lead acepte el merge.

## 2. Convención de nombres de rama

```
<tipo>/<rol>/<slug-tarea>
```

- **`<tipo>`**: `feat` | `fix` | `chore` | `refactor` | `docs` | `test`
- **`<rol>`**: `arq` | `be` | `fe` | `ia` | `ux` | `qa` | `ops`
- **`<slug-tarea>`**: kebab-case corto y descriptivo

Ejemplos: `feat/be/credit-hold-state-machine` · `feat/ia/agente-cualificacion` · `feat/fe/canvas-konva-capas` · `fix/be/webhook-idempotencia` · `chore/ops/ci-pipeline`.

> Variante con versión (opcional, para ramas atadas a un hito): `feat/be/0.3.0-creditos-polar`.

## 3. Mapa de propiedad: rol → ramas → globs → fases

Cada rol trabaja **solo dentro de sus globs** (propiedad de archivos disjunta = sin conflictos de merge). Un rol abre tantas ramas `feat/<rol>/...` como tareas tenga.

| Rol | Prefijo rama | Globs que posee | Fases |
|---|---|---|---|
| **ARQ** Tech Lead | `feat/arq/...` | `package.json`, `tsconfig.json`, `src/lib/contracts/**`, `src/lib/addons/registry/**`, `src/lib/licensing/**`, `docs/legal/*.md`, `src/server/privacy/**`, `docs/legal/tos/**`, `src/server/legal/**`, `tests/integration/e2e-flow/**` | F0, F13, F14, F19, F-INT |
| **BE** Backend | `feat/be/...` | `prisma/**`, `src/server/{db,auth,actions,billing}/**`, `src/server/admin/**`, `src/server/storage/**`, `src/app/api/{auth,health,webhooks/polar,billing,admin}/**` | F2, F8, F15-F18 (BE) |
| **FE** Frontend | `feat/fe/...` | `src/app/(app)/**`, `src/app/(admin)/**`, `src/components/**`, `src/canvas/**` | F4, F6, F9, F10, F15-F18 (UI) |
| **IA** IA Engineer | `feat/ia/...` | `src/server/ai/**`, `src/server/agent/**`, `docs/spikes/**`, `tests/spikes/**` | F3, F5, F7, F-S0 |
| **UX** Diseño/UX | `feat/ux/...` | `docs/ux/**`, `src/styles/**`, tokens shadcn | F1 |
| **QA** Testing | `feat/qa/...` | `tests/**`, `*.test.ts`, `playwright/**` | F12 (+ tests de todas) |
| **OPS** DevOps | `feat/ops/...` | `.github/**`, `Dockerfile`, `infra/**` | F11 |

## 4. Fronteras compartidas (requieren coordinación)

Estos archivos los tocan varios roles → **coordinar en el PR**, no editar en paralelo:

| Archivo / área | Roles que lo necesitan | Regla |
|---|---|---|
| `.env.example` | ARQ (F0), BE (F2/F8), BE-storage (F17), OPS (F11) | Owner = ARQ. Otros piden el cambio en su PR; ARQ consolida. |
| `prisma/migrations/**` | BE (F2/F8/F15-F18) | **Serial**: se integran en un único turno de merge (BE serializa la numeración) para evitar choques. |
| `prisma/schema/**` | BE únicamente | BE es el único owner; admin (F15-F18) **propone** modelos, no edita Prisma. |
| `src/lib/contracts/**` | ARQ (F0) escribe; todos consumen | **Congelado tras M1** (contract freeze gate). Cambios solo vía PR de ARQ + aviso al equipo. |

## 5. Worktree por rol (recomendado)

Cada rol trabaja en un **git worktree** separado para aislar su rama y sus globs sin pisar a otros:

```bash
# Ejemplo: el backend crea su worktree
git worktree add ../habiteka-be develop
cd ../habiteka-be
git checkout -b feat/be/credit-hold-state-machine
```

Así varios roles avanzan en paralelo sobre la misma copia base sin conflictos. Ver skill `worktree`.

## 6. Ciclo de vida de una tarea (paso a paso)

```bash
# 1. Partir de develop actualizado
git checkout develop && git pull

# 2. Crear la rama de tarea (dentro de tus globs)
git checkout -b feat/be/credit-hold-state-machine

# 3. Trabajar test-first (TDD): test rojo → código → verde
#    Commits atómicos, conventional, sin referencias a IA ni nº de fase
git commit -m "feat(billing): hold como máquina de estados con idempotencyKey"

# 4. Rebasar sobre develop antes del PR (historial limpio)
git fetch origin && git rebase origin/develop

# 5. Push y PR hacia develop
git push -u origin feat/be/credit-hold-state-machine
gh pr create --base develop --title "feat(billing): crédito hold/settle"

# 6. CI verde + revisión del TEAM LEAD → el team lead mergea (no tú)
# 7. Tras merge: borrar la rama
git branch -d feat/be/credit-hold-state-machine
git push origin --delete feat/be/credit-hold-state-machine
```

## 7. Release (develop → main) — solo Team Lead

Por **hito entregable** (versión menor): M1, M2, M-INT, M3, M4…

```bash
# (en develop) bump de versión
git commit -m "chore(release): bump version to v0.2.0"
# merge a main (main bloqueada — solo team lead)
git checkout main && git merge --no-ff develop -m "chore(release): v0.2.0"
git push origin main
git tag -a v0.2.0 -m "Release v0.2.0" && git push origin --tags
gh release create v0.2.0 --generate-notes
```

**Mapa versión ↔ hito** (semántico, parche por fixes):

| Versión | Hito | Contenido |
|---|---|---|
| v0.1.x | M1 | Cimientos: F0 contratos, F2 datos/auth, F3 adaptadores, F11 CI |
| v0.2.x | M2 | Flujo core: F4 canvas, F5 agente, F6 chat/entregables, F7 feedback/render |
| v0.3.x | M-INT | Integración e2e (F-INT) |
| v0.4.x | M2.5/M3 | Admin base (F15) + negocio/add-ons (F8-F10, F13, F16, F17) |
| v0.5.x | M4 | Analítica/facturación (F18), QA (F12), RGPD/ToS (F14, F19) |
| v1.0.0 | — | Cierre MVP completo + cumplimiento UE |

> **Gate previo:** M0 (spike de calidad F-S0) decide go/no-go ANTES de v0.2.x. Sin go, M2 no arranca.

## 8. Reglas de oro

- ✅ Una tarea = una rama = un PR pequeño y revisable.
- ✅ Trabaja **solo en tus globs**; si necesitas tocar los de otro rol, coordínalo en el PR.
- ✅ Test-first: nada se considera hecho sin sus tests rojos→verdes.
- ✅ Conventional commits, sin referencias a IA, sin nº de fase en código/comentarios.
- 🚫 No push directo a `develop`/`main`. No mergees tu propio PR. No `--force` sobre ramas compartidas.
