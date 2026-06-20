# Infraestructura & Operación — Habiteka

> Despliegue oficial del MVP: **Easypanel** (PaaS self-host sobre VPS con Docker).
> Self-host por terceros (fair-code): el mismo `Dockerfile` corre en cualquier
> entorno Docker. Este runbook cubre el despliegue oficial en Easypanel.

## Arquitectura de despliegue

```
GitHub (develop / release)
        │  push develop → staging · release → production
        ▼
deploy.yml ── POST webhook ──▶ Easypanel (VPS)
                                  ├─ Servicio App (Dockerfile → Next standalone, Node non-root)
                                  ├─ Servicio Postgres 16 (plantilla Easypanel)
                                  └─ Servicio MinIO (S3-compatible, ver F17)
                                     proxy Traefik (TLS automático)
```

- **App:** Easypanel construye la imagen desde el `Dockerfile` del repo. Comando
  de despliegue del servicio: `prisma migrate deploy && node server.js` (migra
  antes de servir tráfico nuevo).
- **Postgres:** servicio interno del panel; `DATABASE_URL` se inyecta como env
  del servicio App. Backups: ver [backup-dr.md](backup-dr.md).
- **MinIO:** servicio interno S3-compatible para los assets de media (StorageAdapter).
- **TLS:** lo termina el proxy Traefik integrado de Easypanel.

## Entornos

| Entorno | Rama/disparador | Uso |
|---|---|---|
| **staging** | push a `develop` | validación previa a producción |
| **production** | release publicada | servicio en vivo |

Cada entorno es un proyecto/servicio separado en Easypanel con su propia
Postgres y sus propios secrets. Catálogo de variables: [env.reference.md](env.reference.md).

## Despliegue

Automático vía `deploy.yml`:
1. `push` a `develop` (o publicar una release) dispara el workflow.
2. El workflow hace `POST` al **webhook de deploy** del servicio Easypanel
   (`EASYPANEL_DEPLOY_WEBHOOK`, secret del environment).
3. Easypanel reconstruye la imagen, ejecuta `prisma migrate deploy` y arranca el
   nuevo contenedor; el proxy cambia el tráfico al pasar el healthcheck.
4. El workflow espera y verifica `GET /api/health` (200).

Despliegue manual: en el panel de Easypanel, servicio App → **Deploy**.

## Rollback (< 5 min)

1. Easypanel → servicio App → pestaña **Deployments**.
2. Seleccionar el deployment anterior estable → **Redeploy**.
3. Si la causa fue una migración: restaurar Postgres al punto previo
   (ver [backup-dr.md](backup-dr.md)) ANTES de redeploy si la migración fue
   destructiva. Las migraciones aditivas no requieren restore.
4. Verificar `GET /api/health` (200).

## Healthcheck

Contrato del endpoint en [healthcheck.md](healthcheck.md). Lo implementa BE; el
proxy de Easypanel y el smoke test de `deploy.yml` lo consumen.

## Secrets

- Se configuran en **Easypanel** (env del servicio) y en **GitHub Environments**
  (los que usa el deploy). Nunca en el repo ni en build args de la imagen.
- Catálogo completo (sin valores) en [env.reference.md](env.reference.md).
- Inyección en runtime del contenedor; jamás en capas de la imagen ni en logs.

## Observabilidad (MVP)

- Logs del servicio en Easypanel (sin PII ni contenido de prompts).
- Alerta simple de error-rate / fallo de healthcheck (notificación del panel).
- APM completo: post-MVP (YAGNI).
