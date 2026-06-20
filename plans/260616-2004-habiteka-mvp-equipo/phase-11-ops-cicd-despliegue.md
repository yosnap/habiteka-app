# F11 — DevOps: CI/CD, Docker, Secrets & Despliegue (OPS)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) · setup: [phase-00](phase-00-arq-setup-contratos.md)

## Overview
- **Rol primario:** OPS / DevOps
- **Prioridad:** P1 (arranca temprano; habilita merges seguros del resto del equipo)
- **Estado:** Planificado
- **Depende de:** F0 (repo + scripts Bun existen)
- **Paralela con:** casi todas (F1–F10 mergean a través del pipeline de F11)
- **Descripción:** Pipeline CI (lint + typecheck + test + build) en GitHub Actions, `Dockerfile` reproducible, gestión de secrets, estrategia de despliegue coherente con fair-code (Vercel o contenedor self-host), Postgres gestionado y observabilidad básica.

## Key Insights
- Monolito Next.js full-stack → un solo artefacto desplegable; sin orquestación compleja en MVP (YAGNI).
- **Licencia fair-code / hosting oficial** (§8): el despliegue oficial es el cuello de botella que valida licencia. Self-host debe ser posible (contenedor) pero el control de IA vive en el server oficial (F13). **Deploy oficial recomendado = Vercel + Postgres gestionado + S3 gestionado.** El contenedor self-host (Docker) queda como **artefacto documentado para terceros** (fair-code), no como el deploy oficial del MVP.
- **Backup / DR de Postgres (no solo "backup antes de migrar"):** estrategia formal de respaldo y restauración — **PITR** (point-in-time recovery) del Postgres gestionado, **RPO/RTO definidos** (objetivo de pérdida de datos y de tiempo de recuperación) y un **restore PROBADO** (ejercicio de recuperación real, no solo "existe un backup"). Un backup nunca restaurado no es un backup.
- Toda clave es server-side (§3): los secrets de IA/Polar/DB nunca llegan al cliente → CI nunca expone secrets a jobs de PR de forks.
- Postgres con JSONB para estado de canvas (§2/§5) → necesita Postgres gestionado real (no SQLite); migraciones Prisma 7 las define BE en F2, OPS las ejecuta en deploy.
- Polling de votación cada ~2s (§7) → sin infra de WebSocket en MVP; no hay servicio realtime que desplegar.

## Requirements
**Funcionales**
- CI en cada PR (Bun): `bun install --frozen-lockfile`, `bun run lint`, `bun run typecheck`, `bun test`, `bun run build`. Falla el merge si algo falla.
- `Dockerfile` multi-stage que construye y arranca la app Next.js standalone.
- Gestión de secrets por entorno (CI, staging, prod) sin valores en el repo.
- Pipeline de deploy a staging en merge a `dev`; a prod en tag/release.
- Migraciones Prisma (`prisma migrate deploy`) ejecutadas antes de levantar la app nueva.
- **Backup/DR de Postgres:** PITR habilitado en el Postgres gestionado; RPO/RTO documentados; runbook de restore + un ejercicio de restore probado (a un entorno aparte) antes del lanzamiento.

**No funcionales**
- Build reproducible y cacheado (deps + Next cache) → CI < ~8 min.
- Secrets nunca en logs ni accesibles a workflows de PR de forks.
- Rollback de un deploy en < 5 min.
- Healthcheck endpoint para readiness del contenedor.

## Architecture
```
.github/workflows/
  ci.yml         # PR + push: install → lint → typecheck → test → build (Postgres de servicio para tests de integración)
  deploy.yml     # merge dev → staging; release/tag → prod (migrate deploy → deploy → smoke)
Dockerfile       # multi-stage: deps+build con Bun (oven/bun) → runner con Node slim, non-root (sirve Next standalone)
.dockerignore
infra/
  README.md            # runbook: secrets, deploy, rollback
  env.reference.md     # catálogo de variables/secrets por entorno (sin valores)
  healthcheck.md       # contrato del endpoint /api/health (lo implementa BE en F2; OPS lo consume)
  backup-dr.md         # estrategia PITR + RPO/RTO + runbook de restore PROBADO (Postgres y bucket S3)
```
**Secrets:** `OPENROUTER_API_KEY`, `IMAGE_PROVIDER_KEY`, `POLAR_*`, `DATABASE_URL`, `BETTER_AUTH_SECRET` → GitHub Environments (staging/prod) + provider de deploy. Inyectados en runtime del contenedor/función, nunca en build args que queden en capas.

**Targets de deploy (decisión coherente con fair-code):**
- **Deploy oficial (recomendado) — Vercel + Postgres gestionado + S3 gestionado:** Postgres gestionado con PITR (Neon/Supabase/RDS); storage en **S3 gestionado** (no MinIO single-node, ver F17). Rápido y con backup/HA del proveedor.
- **Self-host (artefacto documentado para terceros):** `Dockerfile` standalone + Postgres + MinIO, para quien quiera operar su propia instancia (fair-code). Documentado en runbook; NO es el deploy oficial del MVP.

**Observabilidad básica:** logs estructurados de la app (sin contenido sensible de prompts, §F3), métricas del proveedor de hosting, alerta simple de error rate y de fallo de healthcheck. APM completo = post-MVP (YAGNI).

## Related Code Files
**A crear (owner OPS):**
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- `Dockerfile`, `.dockerignore`
- `infra/README.md`, `infra/env.reference.md`, `infra/healthcheck.md`, `infra/backup-dr.md`
**Lee (no edita):** `package.json` (scripts), `.env.example` (de F0), `prisma/` (comandos migrate, NO edita schema).
**NO tocar:** `src/**`, `prisma/schema.prisma`, contratos. El endpoint `/api/health` lo implementa BE (F2); OPS solo lo consume en healthcheck.

## Implementation Steps
1. `ci.yml`: `oven-sh/setup-bun` con versión fijada; cache de `~/.bun/install/cache` + `.next/cache`; servicio Postgres para tests de integración; pasos `bun install --frozen-lockfile`→lint→typecheck→test→build.
2. Bloquear secrets en jobs de PR de forks (usar `pull_request_target` con cautela o gates de aprobación).
3. `Dockerfile` multi-stage: stage de build con imagen `oven/bun` (`bun install` + `bun run build`, `output: 'standalone'` de Next); **runner sobre Node slim non-root** que sirve el standalone con `CMD ["node", "server.js"]` (Bun NO sirve Next en prod, ver decisión de stack); `EXPOSE` del puerto de prod (env `PORT`, no 3040).
4. `.dockerignore` (node_modules, .next salvo standalone, .env*, .git).
5. Configurar GitHub Environments staging/prod con sus secrets; mapear catálogo en `infra/env.reference.md`.
6. `deploy.yml`: en `dev`→staging y en release→prod; paso `prisma migrate deploy` ANTES de cambiar tráfico; smoke test al `/api/health` post-deploy.
7. Configurar Postgres gestionado (staging + prod) con **PITR** y `DATABASE_URL` por entorno; configurar S3 gestionado (oficial) y backup del bucket.
8. Logs estructurados + alerta de error-rate/healthcheck en el proveedor.
9. Documentar runbook de deploy y rollback en `infra/README.md`; **`infra/backup-dr.md`**: PITR, RPO/RTO, pasos de restore.
10. **Ejercicio de restore PROBADO:** restaurar un snapshot/PITR a un entorno aparte y verificar integridad (no solo "existe backup"). Repetir antes del lanzamiento.
11. Validar pipeline completo con un PR de prueba (verde) y un deploy a staging.

## Todo List
- [ ] `ci.yml`: lint + typecheck + test + build con Postgres de servicio
- [ ] Secrets bloqueados en PRs de forks
- [ ] `Dockerfile` standalone multi-stage non-root
- [ ] GitHub Environments staging/prod + catálogo de env
- [ ] `deploy.yml` con `migrate deploy` previo + smoke test
- [ ] Postgres gestionado por entorno con PITR; S3 gestionado (oficial) + backup de bucket
- [ ] Backup/DR: `infra/backup-dr.md` (PITR, RPO/RTO) + **restore probado** a entorno aparte
- [ ] Logs estructurados + alerta error-rate/healthcheck
- [ ] Runbook deploy + rollback
- [ ] Pipeline validado end-to-end en staging

## Success Criteria
- PR no mergeable si lint/typecheck/test/build fallan.
- `docker build` produce imagen que arranca y responde 200 en `/api/health`.
- Merge a `dev` despliega a staging automáticamente con migraciones aplicadas.
- Rollback documentado y probado (< 5 min).
- PITR activo; RPO/RTO documentados; **restore probado** a entorno aparte con integridad verificada.
- Ningún secret aparece en logs de CI ni es accesible a workflows de fork.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Secrets expuestos en CI/logs/build args | Baja | Crítico | Environments + masking; nunca como build args; gate en PRs de fork |
| Migración rompe prod al desplegar | Media | Alto | `migrate deploy` previo + smoke test; rollback de release; PITR + restore probado (no solo backup pre-migración) |
| Pérdida de datos sin DR (backup nunca restaurado) | Baja | Crítico | PITR habilitado + RPO/RTO definidos + ejercicio de restore probado a entorno aparte antes del lanzamiento |
| Build Next.js 16 standalone falla en Docker | Media | Medio | Probar imagen en CI; fijar versión de Bun (build) y Node (runner); `output: standalone` validado temprano |
| Incompatibilidad de Bun con alguna lib del build (Prisma/nativas) | Media | Medio | Build con Bun validado en F0/CI temprano; runner sigue en Node; fallback a npm/pnpm solo si una lib rompe el build (no afecta runtime de prod) |
| Decisión Vercel vs self-host bloquea deploy | Media | Medio | Soportar ambos en runbook; elegir uno para MVP; el otro queda documentado |
| Postgres gestionado mal dimensionado (JSONB) | Baja | Medio | Plan con margen; monitor de conexiones; pool en app (config BE) |

## Security Considerations
- Secrets solo en runtime; nunca en capas de imagen ni en el repo.
- Contenedor non-root; superficie mínima (node slim).
- TLS gestionado por el proveedor de hosting/proxy.
- Logs sin contenido sensible de prompts/PII (coordina con la política de logging de F3).
- Acceso a deploy a prod tras aprobación (protected environment).

## TDD / Pruebas primero
El pipeline es el **enforcement** del enfoque test-first (la suite la define F12; F11 la cablea):
- **CI corre Vitest + Playwright**: `ci.yml` ejecuta unit/integration (Vitest) bloqueantes y e2e/visual/a11y (Playwright) en job aparte. **El build FALLA si falla un test** — nunca se ignora un test para pasar el merge.
- **Cero red a IA/pagos en CI**: el job no expone `OPENROUTER_API_KEY`/`POLAR_*`; los tests usan fakes/firmador local (invariante de F12). Un test que importe el adaptador real debe romper el job.
- **DB de test real**: servicio Postgres efímero para integration → valida migraciones de F2.
- **Self-test del pipeline** (verde→rojo→verde): un PR de prueba con un test que falla debe bloquear el merge; al corregirlo, pasa. Smoke test a `/api/health` post-deploy.
- **Mock:** OPS no escribe tests de producto; aísla/cablea. Los mocks de IA/Polar son responsabilidad de F12.

## Next Steps
No bloquea features (corre en paralelo), pero **habilita** merges seguros de F1–F10 y el despliegue del MVP. El endpoint `/api/health` que consume depende de F2. El control de licencia/key (F13) se apoya en este despliegue oficial.
