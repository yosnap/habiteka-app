# Migración de Habiteka de Dokploy a Coolify

Estado: preparado, pendiente de ventana de corte. Modalidad elegida: **corte directo** (sin entorno paralelo previo).

## Resultado esperado

Habiteka sirve `habiteka.app` y `docs.habiteka.app` desde un proyecto nuevo «Habiteka» en Coolify
(servidor «Humanitek», 169.58.194.58), con todos los datos actuales: Postgres completo, bucket de
MinIO completo y las mismas variables de entorno. Dokploy (187.77.74.84) queda parado pero intacto
como vía de vuelta atrás.

## Origen (Dokploy, proyecto «Habitekka»)

| Recurso | Detalle |
|---|---|
| App `habitekka` | GitHub `yosnap/habiteka-app`, rama `main`, Dockerfile, puerto 3000, autodeploy en push |
| Dominios | `habiteka.app`, `docs.habiteka.app` (Let's Encrypt) y uno sslip.io |
| Postgres `habiteka-db` | `postgres:17`, BD y usuario `habiteka`, volumen `habiteka-db-prdzle-data`, sin puerto externo, **sin backups** |
| MinIO `habiteka-minio` | compose raw, bucket `habiteka`, endpoint público sslip.io por Traefik (URL firmadas) |
| `minio-habitekka` | compose en `idle`, sin uso aparente: no se migra |

## Destino (Coolify 4.5.0)

1. Proyecto `Habiteka`, entorno `production`.
2. Base de datos PostgreSQL con imagen `postgres:17` (misma versión mayor: el volcado restaura sin conversión).
3. Servicio Docker Compose de MinIO (`quay.io/minio/minio`), volumen persistente, bucket `habiteka`
   y dominio público propio para el API S3: se propone `s3.habiteka.app` en lugar de sslip.io.
4. Aplicación desde la GitHub App `yosnap`: repo `yosnap/habiteka-app`, rama `main`, build pack
   Dockerfile, puerto 3000, healthcheck `GET /api/health`, dominios `habiteka.app` y `docs.habiteka.app`.
5. Variables: las mismas de Dokploy (catálogo en `infra/env.reference.md`), cambiando solo
   `DATABASE_URL` (host interno de la Postgres de Coolify) y `STORAGE_ENDPOINT` /
   `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` (MinIO nuevo). `BETTER_AUTH_URL`,
   OAuth de Google/Facebook y el webhook de Polar no cambian porque el dominio se mantiene.
6. Backups programados de Postgres en Coolify con destino S3 externo (hoy no hay ninguno).

Las URL firmadas de MinIO se generan al vuelo con `STORAGE_ENDPOINT`; la BD guarda claves, no URL,
así que cambiar el endpoint no deja referencias rotas.

## Preparación (sin cortar el servicio)

- [ ] Mergear `chore/next-16-4` a `develop` y a `main` tras la prueba local (la app de Coolify construirá `main`).
- [ ] Crear en Coolify el proyecto, la Postgres y el MinIO vacíos.
- [ ] Crear la app en Coolify **sin dominios de producción** y con un dominio sslip.io temporal; cargar variables.
- [ ] Copiar las variables desde Dokploy (el MCP las devuelve redactadas: se pegan desde el panel de Dokploy, modo «Raw»).
- [ ] Bajar el TTL de los registros DNS de `habiteka.app` y `docs.habiteka.app` a 300 s con antelación.
- [ ] Ensayo en seco: volcado de Postgres y espejo de MinIO a Coolify mientras Dokploy sigue sirviendo,
      para medir tiempos y comprobar que la app de Coolify arranca con datos reales en su dominio temporal.

## Corte (ventana de mantenimiento)

1. Desactivar el autodeploy de la app en Dokploy (si no, cada push a `main` desplegaría en los dos sitios).
2. Parar la app en Dokploy (congela escrituras). Desde aquí hay caída.
3. Abrir temporalmente un puerto externo en la Postgres de Dokploy y volcar con
   `pg_dump -Fc` desde un contenedor `postgres:17` (el `pg_dump` 14 local no sirve contra Postgres 17).
4. Restaurar en la Postgres de Coolify con `pg_restore --no-owner --no-privileges` (puerto público temporal en Coolify).
5. Verificar conteos de `user`, `organization`, `project`, `CreditLedger` y la consistencia del ledger
   (saldo igual a la suma de movimientos) en origen y destino.
6. Espejo del bucket con `mc mirror --preserve` (contenedor `minio/mc`) de MinIO Dokploy a MinIO Coolify; comparar número de objetos y tamaño.
7. Cerrar los puertos públicos temporales de ambas Postgres.
8. Desplegar la app en Coolify (el entrypoint aplica migraciones pendientes, p. ej. `invitation.createdAt`).
9. Mover los dominios: quitar `habiteka.app` y `docs.habiteka.app` de Dokploy, añadirlos en Coolify y
   cambiar los registros A a `169.58.194.58`.
10. Comprobar `GET /api/health` = 200, certificado válido, inicio de sesión, un proyecto con imágenes
    (URL firmadas contra el MinIO nuevo) y la documentación en `docs.habiteka.app`.

## Vuelta atrás

Registros A otra vez a `187.77.74.84`, dominios de nuevo en la app de Dokploy y arrancarla. Las
escrituras hechas en Coolify durante el intento se perderían; por eso la verificación del paso 10 se
hace antes de abrir el servicio a usuarios.

## Riesgos

- Caída durante todo el corte (volcado + espejo + despliegue + propagación DNS). El ensayo en seco da la estimación real.
- El VPS de Coolify ya aloja Humanitek y Escenara; las métricas Sentinel están desactivadas, así que
  conviene revisar disco y RAM antes (la compilación de la imagen necesita varios GB).
- Polar envía webhooks al dominio: durante la caída fallan y Polar los reintenta.

## Documentación al terminar

Actualizar `infra/README.md`, `infra/backup-dr.md`, `infra/env.reference.md`, el comentario del
`Dockerfile` (menciona Dokploy) y `docs/documentacion-starlight.md` (despliegue de la documentación).
