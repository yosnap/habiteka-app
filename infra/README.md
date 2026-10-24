# Infraestructura & Operación — Habiteka

> Despliegue oficial: **Coolify 4.5** (PaaS self-host sobre VPS con Docker),
> proyecto **Habiteka** en el servidor `Humanitek` (169.58.194.58). Migrado
> desde Dokploy (187.77.74.84) el 24 de octubre de 2026; el proyecto
> «Habitekka» de Dokploy queda parado como respaldo y no recibe despliegues.
> Self-host por terceros (fair-code): el mismo `Dockerfile` corre en cualquier
> entorno Docker. Este runbook cubre el despliegue oficial en Coolify.

## Arquitectura de despliegue

```
GitHub (main)
        │  push → la GitHub App `yosnap` de Coolify notifica al panel
        ▼
Coolify (VPS Humanitek)
   ├─ Aplicación `habiteka` (Dockerfile → migraciones Prisma + Next standalone, Node non-root)
   │    dominios: habiteka.app, www.habiteka.app, docs.habiteka.app
   ├─ Postgres 17 `habiteka-db` (base de datos del proyecto, sin puerto público)
   └─ SeaweedFS `habiteka-almacen` (S3-compatible, bucket `habiteka`)
      proxy Traefik (TLS automático con Let's Encrypt)
```

- **App:** Coolify construye la imagen desde el `Dockerfile` del repo (build
  type `dockerfile`). El contenedor arranca por `docker-entrypoint.sh`, que
  ejecuta `prisma migrate deploy` y después `node server.js`; si la migración
  falla, el servidor no arranca y el deploy queda marcado como fallido.
- **Postgres:** servicio interno del proyecto; `DATABASE_URL` se inyecta como
  env de la aplicación con el host interno del servicio. Backups: ver
  [backup-dr.md](backup-dr.md).
- **Storage:** SeaweedFS (`chrislusf/seaweedfs`) con la API S3 en el puerto 8333,
  publicada por Traefik para las URL firmadas. MinIO dejó de publicar imágenes
  Docker descargables, por eso se sustituyó en la migración. Los clientes S3
  usan `requestChecksumCalculation: 'WHEN_REQUIRED'`: SeaweedFS, como AWS,
  rechaza las subidas firmadas que llevan el checksum de un cuerpo vacío.
- **Variables:** todas son solo de runtime (no «Available at Buildtime»); con
  `NODE_ENV=production` en el build se omitirían las devDependencies.
- **Healthcheck de Coolify desactivado:** Coolify lo ejecuta con `curl`/`wget`
  dentro del contenedor y la imagen `node:22-slim` no los incluye, así que el
  deploy se marcaba como fallido aunque la app arrancara. `GET /api/health`
  sigue disponible para monitorización externa.
- **TLS:** lo termina el proxy Traefik integrado de Coolify.

## Entornos

| Entorno | Rama/disparador | Uso |
|---|---|---|
| **production** | push a `main` (autodeploy) | servicio en vivo |
| **staging** | no existe todavía | si se necesita: segunda aplicación apuntando a `develop` |

Cada entorno es una aplicación separada en Coolify con su propia Postgres y sus
propios secrets. Catálogo de variables: [env.reference.md](env.reference.md).

## Despliegue

Automático: la GitHub App instalada en Coolify recibe el push a `main` y el
panel reconstruye la imagen y la despliega (no hay workflow de despliegue en
`.github/workflows`; `ci.yml` solo valida calidad).

1. Merge a `main` (release desde `develop`).
2. Coolify clona el repo, construye el `Dockerfile` y arranca el contenedor.
3. El entrypoint aplica las migraciones pendientes y levanta el servidor.
4. El proxy conmuta el tráfico cuando el contenedor responde.

Despliegue manual: en Coolify, aplicación → **Deploy** (o `deploy` por su
API/MCP). Logs: aplicación → **Logs** (o `get_logs`).

## Rollback (< 5 min)

1. Coolify → aplicación → pestaña **Rollback** (imágenes anteriores).
2. Seleccionar la imagen estable anterior → **Rollback**.
3. Si la causa fue una migración: restaurar Postgres al punto previo
   (ver [backup-dr.md](backup-dr.md)) ANTES del rollback si la migración fue
   destructiva. Las migraciones aditivas no requieren restore. Ojo: el
   contenedor anterior también ejecuta `migrate deploy` al arrancar, pero solo
   aplica migraciones que aún no estén registradas en `_prisma_migrations`.
4. Verificar `GET /api/health` (200).

## Healthcheck

Contrato del endpoint en [healthcheck.md](healthcheck.md). Lo implementa
`src/app/api/health/route.ts`; el healthcheck de la aplicación en Coolify lo consume.

## Secrets

- Se configuran en **Coolify** (aplicación → Environment Variables). Nunca en el repo ni
  en build args de la imagen.
- Catálogo completo (sin valores) en [env.reference.md](env.reference.md).
- Inyección en runtime del contenedor; jamás en capas de la imagen ni en logs.

## Observabilidad (MVP)

- Logs de la aplicación en Coolify (sin PII ni contenido de prompts).
- Alerta simple de fallo de deploy / healthcheck (notificaciones del panel).
- APM completo: post-MVP (YAGNI).
