# Infraestructura & Operación — Habiteka

> Despliegue oficial del MVP: **Dokploy** (PaaS self-host sobre VPS con Docker).
> Self-host por terceros (fair-code): el mismo `Dockerfile` corre en cualquier
> entorno Docker. Este runbook cubre el despliegue oficial en Dokploy.

## Arquitectura de despliegue

```
GitHub (main)
        │  push → la app de GitHub de Dokploy notifica al panel
        ▼
Dokploy (VPS)
   ├─ Aplicación (Dockerfile → migraciones Prisma + Next standalone, Node non-root)
   ├─ Postgres 17 (servicio interno del proyecto)
   └─ Object storage S3-compatible (MinIO o S3/R2 externo, ver F17)
      proxy Traefik (TLS automático)
```

- **App:** Dokploy construye la imagen desde el `Dockerfile` del repo (build
  type `dockerfile`). El contenedor arranca por `docker-entrypoint.sh`, que
  ejecuta `prisma migrate deploy` y después `node server.js`; si la migración
  falla, el servidor no arranca y el deploy queda marcado como fallido.
- **Postgres:** servicio interno del proyecto; `DATABASE_URL` se inyecta como
  env de la aplicación con el host interno del servicio. Backups: ver
  [backup-dr.md](backup-dr.md).
- **Storage:** servicio S3-compatible para los assets de media (StorageAdapter).
- **TLS:** lo termina el proxy Traefik integrado de Dokploy.

## Entornos

| Entorno | Rama/disparador | Uso |
|---|---|---|
| **production** | push a `main` (autodeploy) | servicio en vivo |
| **staging** | no existe todavía | si se necesita: segunda aplicación apuntando a `develop` |

Cada entorno es una aplicación separada en Dokploy con su propia Postgres y sus
propios secrets. Catálogo de variables: [env.reference.md](env.reference.md).

## Despliegue

Automático: la app de GitHub instalada en Dokploy recibe el push a `main` y el
panel reconstruye la imagen y la despliega (no hay workflow de despliegue en
`.github/workflows`; `ci.yml` solo valida calidad).

1. Merge a `main` (release desde `develop`).
2. Dokploy clona el repo, construye el `Dockerfile` y arranca el contenedor.
3. El entrypoint aplica las migraciones pendientes y levanta el servidor.
4. El proxy conmuta el tráfico cuando el contenedor responde.

Despliegue manual: en Dokploy, aplicación → **Deploy** (o `application-deploy`
por su API/MCP). Logs: aplicación → **Logs** (o `application-readLogs`).

## Rollback (< 5 min)

1. Dokploy → aplicación → pestaña **Deployments**.
2. Seleccionar el deployment anterior estable → **Rollback**.
3. Si la causa fue una migración: restaurar Postgres al punto previo
   (ver [backup-dr.md](backup-dr.md)) ANTES del rollback si la migración fue
   destructiva. Las migraciones aditivas no requieren restore. Ojo: el
   contenedor anterior también ejecuta `migrate deploy` al arrancar, pero solo
   aplica migraciones que aún no estén registradas en `_prisma_migrations`.
4. Verificar `GET /api/health` (200).

## Healthcheck

Contrato del endpoint en [healthcheck.md](healthcheck.md). Lo implementa
`src/app/api/health/route.ts`; el proxy de Dokploy lo consume.

## Secrets

- Se configuran en **Dokploy** (aplicación → Environment). Nunca en el repo ni
  en build args de la imagen.
- Catálogo completo (sin valores) en [env.reference.md](env.reference.md).
- Inyección en runtime del contenedor; jamás en capas de la imagen ni en logs.

## Observabilidad (MVP)

- Logs de la aplicación en Dokploy (sin PII ni contenido de prompts).
- Alerta simple de fallo de deploy / healthcheck (notificaciones del panel).
- APM completo: post-MVP (YAGNI).
