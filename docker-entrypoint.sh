#!/bin/sh
# Entrypoint del contenedor de producción.
#
# 1. Aplica las migraciones pendientes con la CLI de Prisma aislada en
#    /app/migrate (ver Dockerfile, etapa `migrate`). `migrate deploy` es
#    idempotente: si no hay migraciones nuevas no toca la base de datos.
# 2. Cede el proceso al comando recibido (por defecto `node server.js`), de modo
#    que el servidor sea PID 1 y reciba las señales de parada del orquestador.
#
# Si la migración falla, el contenedor termina sin arrancar el servidor: el
# deploy queda marcado como fallido y el contenedor anterior sigue sirviendo.
set -eu

echo "[entrypoint] Aplicando migraciones de Prisma…"
(cd /app/migrate && node node_modules/prisma/build/index.js migrate deploy)

echo "[entrypoint] Arrancando: $*"
exec "$@"
