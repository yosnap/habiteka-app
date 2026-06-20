# Contrato del healthcheck — `GET /api/health`

> Lo **implementa BE**; OPS solo lo **consume** (proxy de Easypanel + smoke test
> de `deploy.yml`). Este documento fija el contrato esperado.

## Contrato

| Aspecto | Valor |
|---|---|
| Método / ruta | `GET /api/health` |
| Auth | Ninguna (endpoint público de readiness) |
| Éxito | `200` con cuerpo JSON `{ "status": "ok" }` |
| Degradado/fallo | `503` cuando una dependencia crítica (Postgres) no responde |
| Latencia objetivo | < 1 s |
| Contenido sensible | Ninguno — sin secrets, sin PII, sin versiones internas detalladas |

## Comprobaciones recomendadas (BE)

- **Liveness:** el proceso responde.
- **Readiness:** conexión a Postgres OK (consulta trivial, p. ej. `SELECT 1`).
- No incluir dependencias externas de IA/pagos en el readiness (evita marcar la
  app como caída por un proveedor externo lento).

## Consumidores

- **Easypanel:** healthcheck del servicio para conmutar tráfico tras un deploy.
- **`deploy.yml`:** smoke test post-deploy (espera `200` en reintentos).

> Hasta que BE implemente el endpoint, el smoke test del deploy queda como paso
> informativo (no bloquea el deploy si `APP_BASE_URL` no está configurado).
