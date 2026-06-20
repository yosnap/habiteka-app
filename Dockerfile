# Imagen de producción de Habiteka.
#
# Estrategia de runtime: Bun construye (rápido en deps + build), pero Node sirve
# la app en producción — servir Next sobre el runtime de Bun aún arrastra
# incompatibilidades con el modo standalone, Prisma y libs nativas. Por eso el
# build usa `oven/bun` y el runner final usa `node:slim` ejecutando `server.js`
# del output standalone. Easypanel construye esta imagen desde el repo.

# ---------- Stage 1: dependencias ----------
FROM oven/bun:1.3.12 AS deps
WORKDIR /app
# Instala con lockfile congelado para builds reproducibles.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM oven/bun:1.3.12 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Genera `.next/standalone` (server.js) + `.next/static`.
RUN bun run build

# ---------- Stage 3: runner ----------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Puerto de producción configurable; Easypanel mapea su proxy a este puerto.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario sin privilegios: el contenedor nunca corre como root.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Solo se copia el output standalone (binario mínimo) + assets estáticos y
# públicos. No se arrastra el árbol completo de node_modules ni el código fuente.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# El servidor standalone de Next lee PORT/HOSTNAME del entorno.
CMD ["node", "server.js"]
