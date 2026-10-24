# Backup & Disaster Recovery — Postgres y almacenamiento S3

> Un backup que nunca se ha restaurado no es un backup. Este runbook define la
> estrategia de respaldo, los objetivos RPO/RTO y el ejercicio de restore que
> debe realizarse **antes del lanzamiento** y repetirse periódicamente.
>
> Despliegue en **Coolify**: Postgres y SeaweedFS son recursos del panel sobre el
> VPS. A diferencia de un Postgres gestionado (Neon/RDS), el PITR no viene
> "de fábrica" — hay que habilitarlo explícitamente con respaldos frecuentes.

## Objetivos

| Métrica | Objetivo MVP |
|---|---|
| **RPO** (máx. pérdida de datos) | ≤ 15 min |
| **RTO** (máx. tiempo de recuperación) | ≤ 60 min |

> El RPO de 15 min exige respaldos frecuentes o WAL archiving; un dump diario
> NO cumple este objetivo. Ajustar la frecuencia de backup a este RPO.

## Postgres

### Respaldo
- **Estado actual:** backup diario de la base `habiteka-db` en Coolify (03:00,
  copias locales en el servidor). Todavía no hay destino S3 externo ni la
  frecuencia que exige el RPO.
- **Dumps programados** al menos cada 15 min para cumplir el RPO, o WAL
  archiving para PITR real.
- Destino del backup: **fuera del mismo VPS** (bucket externo / almacenamiento
  remoto) — un backup en el mismo disco no protege ante pérdida del host.
- Retención: 7 días en caliente + 1 mensual de archivo (ajustable).

### Restore (runbook)
1. Aprovisionar una instancia Postgres limpia (base de datos aparte en Coolify o
   contenedor temporal) — **no** restaurar sobre producción directamente.
2. Cargar el último dump válido (`pg_restore` / `psql`).
3. Verificar integridad: conteo de filas de tablas clave (User, Project,
   CreditLedger), consistencia del ledger (saldo = suma de movimientos).
4. Si es recuperación de prod: apuntar `DATABASE_URL` a la instancia restaurada,
   o promover la instancia restaurada y redeploy.

## Almacenamiento S3 (assets de media)

- **Respaldo:** sync del bucket `habiteka` a almacenamiento remoto con rclone
  (`rclone copy`/`check`, imagen `rclone/rclone`), como en la migración.
- **Restore:** sync inverso a un bucket limpio; verificar que las presigned URLs
  resuelven los objetos esperados.
- Postgres referencia los assets por clave: un restore de Postgres sin su bucket
  correspondiente deja referencias colgando → **restaurar ambos al mismo punto**.

## Ejercicio de restore PROBADO (obligatorio antes del lanzamiento)

1. Tomar un backup reciente de staging.
2. Restaurarlo a un entorno **aparte** siguiendo el runbook de arriba.
3. Verificar integridad (conteos + consistencia del ledger + assets resuelven).
4. Cronometrar el proceso completo → confirmar que cumple el **RTO**.
5. Documentar fecha del ejercicio y resultado. Repetir periódicamente y tras
   cambios mayores de schema.

## Restore probado — migración a Coolify (24 de octubre de 2026)

Dump `pg_dump` en formato custom de la Postgres de Dokploy (70 MB comprimido),
restaurado con `pg_restore --no-owner --no-acl` en la Postgres 17 de Coolify
sin errores: 26 migraciones, 30 proyectos, 673 revisiones del editor y 244
movimientos del ledger. El bucket (98 objetos, 217 MiB) se copió con rclone y
`rclone check` no dio diferencias. Corte completo en unos 15 minutos.

## Pendiente de infraestructura (lo configura OPS con acceso al VPS)

- [ ] Frecuencia de backup de Postgres ajustada al RPO (15 min) o WAL archiving.
- [ ] Destino de backup **fuera del VPS**.
- [ ] Sync del bucket S3 a almacenamiento remoto.
- [ ] Primer ejercicio de restore probado + cronometrado (RTO) antes de lanzar.
