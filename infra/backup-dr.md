# Backup & Disaster Recovery — Postgres y MinIO

> Un backup que nunca se ha restaurado no es un backup. Este runbook define la
> estrategia de respaldo, los objetivos RPO/RTO y el ejercicio de restore que
> debe realizarse **antes del lanzamiento** y repetirse periódicamente.
>
> Despliegue en **Easypanel**: Postgres y MinIO son servicios del panel sobre el
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
- **Dumps programados** del servicio Postgres de Easypanel (al menos cada 15 min
  para cumplir el RPO, o configurar WAL archiving para PITR real).
- Destino del backup: **fuera del mismo VPS** (bucket externo / almacenamiento
  remoto) — un backup en el mismo disco no protege ante pérdida del host.
- Retención: 7 días en caliente + 1 mensual de archivo (ajustable).

### Restore (runbook)
1. Aprovisionar una instancia Postgres limpia (servicio aparte en Easypanel o
   contenedor temporal) — **no** restaurar sobre producción directamente.
2. Cargar el último dump válido (`pg_restore` / `psql`).
3. Verificar integridad: conteo de filas de tablas clave (User, Project,
   CreditLedger), consistencia del ledger (saldo = suma de movimientos).
4. Si es recuperación de prod: apuntar `DATABASE_URL` a la instancia restaurada,
   o promover la instancia restaurada y redeploy.

## MinIO (assets de media)

- **Respaldo:** replicación/sync del bucket a almacenamiento remoto
  (`mc mirror` programado).
- **Restore:** sync inverso a un bucket limpio; verificar que las presigned URLs
  resuelven los objetos esperados.
- Postgres referencia los assets por clave: un restore de Postgres sin su MinIO
  correspondiente deja referencias colgando → **restaurar ambos al mismo punto**.

## Ejercicio de restore PROBADO (obligatorio antes del lanzamiento)

1. Tomar un backup reciente de staging.
2. Restaurarlo a un entorno **aparte** siguiendo el runbook de arriba.
3. Verificar integridad (conteos + consistencia del ledger + assets resuelven).
4. Cronometrar el proceso completo → confirmar que cumple el **RTO**.
5. Documentar fecha del ejercicio y resultado. Repetir periódicamente y tras
   cambios mayores de schema.

## Pendiente de infraestructura (lo configura OPS con acceso al VPS)

- [ ] Frecuencia de backup de Postgres ajustada al RPO (15 min) o WAL archiving.
- [ ] Destino de backup **fuera del VPS**.
- [ ] Sync de bucket MinIO a almacenamiento remoto.
- [ ] Primer ejercicio de restore probado + cronometrado (RTO) antes de lanzar.
