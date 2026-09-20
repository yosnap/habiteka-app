# Contrato del healthcheck — `GET /api/health`

> Implementado en `src/app/api/health/route.ts`; lo consume el proxy de
> Dokploy. Este documento fija el contrato.

## Contrato

| Aspecto | Valor |
|---|---|
| Método / ruta | `GET /api/health` |
| Auth | Ninguna (endpoint público de readiness) |
| Éxito | `200` con cuerpo JSON `{ "status": "ok" }` |
| Degradado/fallo | `503` cuando una dependencia crítica (Postgres) no responde |
| Latencia objetivo | < 1 s |
| Contenido sensible | Ninguno — sin secrets, sin PII, sin versiones internas detalladas |

## Comprobaciones

- **Liveness:** el proceso responde.
- **Readiness:** conexión a Postgres OK (consulta trivial, p. ej. `SELECT 1`).
- No incluir dependencias externas de IA/pagos en el readiness (evita marcar la
  app como caída por un proveedor externo lento).

## Consumidores

- **Dokploy:** healthcheck de la aplicación para conmutar tráfico tras un deploy.
- **Comprobación manual** tras un deploy o un rollback: `curl -i <URL>/api/health`.
