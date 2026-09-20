# Imagen de producción de Habiteka.
#
# Estrategia de runtime: Bun construye (rápido en deps + build), pero Node sirve
# la app en producción — servir Next sobre el runtime de Bun aún arrastra
# incompatibilidades con el modo standalone, Prisma y libs nativas. Por eso el
# build usa `oven/bun` y el runner final usa `node:slim` ejecutando `server.js`
# del output standalone. Dokploy construye esta imagen desde el repo en cada
# push a la rama vinculada.
#
# Migraciones: el output standalone de Next no incluye la CLI de Prisma, así que
# la etapa `migrate` instala una copia mínima (solo `prisma` + `dotenv`, con las
# mismas versiones que el package.json raíz) que el entrypoint ejecuta con
# `prisma migrate deploy` antes de arrancar el servidor.

# ---------- Stage 1: dependencias ----------
FROM oven/bun:1.3.12 AS deps
WORKDIR /app
# Instala con lockfile congelado para builds reproducibles. El `postinstall`
# del proyecto ejecuta `prisma generate`, que necesita el config y el schema.
# prisma.config.ts resuelve DATABASE_URL al cargarse aunque `generate` no la
# use: se pasa un valor de relleno solo en este paso (no queda en la imagen).
COPY package.json bun.lock prisma.config.ts ./
COPY prisma/schema ./prisma/schema
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build bun install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM oven/bun:1.3.12 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# El cliente de Prisma se genera en `src/generated` (fuera de node_modules y
# gitignorado), así que hay que regenerarlo aquí antes de compilar. La URL de
# relleno solo sirve para cargar prisma.config.ts; ninguna consulta se ejecuta
# en build (la real llega por entorno al arrancar el contenedor).
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN bun run db:generate
# Genera `.next/standalone` (server.js) + `.next/static`. El chequeo de tipos
# se omite aquí (ver next.config.ts): CI ya lo hace y el VPS anda justo de RAM.
ENV NEXT_SKIP_TYPECHECK=1
RUN bun run build

# ---------- Stage 3: CLI de migraciones ----------
# Instalación aislada de la CLI de Prisma para el runner. Se toma la versión
# del package.json raíz para que la CLI que migra coincida con la que generó el
# cliente. `dotenv` lo importa prisma.config.ts (en el contenedor no hay .env,
# la URL llega por entorno). `@prisma/engines` descarga aquí el schema engine
# para Linux; bun solo ejecuta ese postinstall si el paquete está en
# trustedDependencies.
FROM oven/bun:1.3.12 AS migrate
WORKDIR /migrate
COPY package.json /tmp/root-package.json
RUN PRISMA_VERSION=$(bun -e 'console.log(require("/tmp/root-package.json").devDependencies.prisma)') \
  && DOTENV_VERSION=$(bun -e 'console.log(require("/tmp/root-package.json").devDependencies.dotenv)') \
  && printf '{"name":"habiteka-migrate","private":true,"dependencies":{"prisma":"%s","dotenv":"%s"},"trustedDependencies":["prisma","@prisma/engines"]}' \
       "$PRISMA_VERSION" "$DOTENV_VERSION" > package.json \
  && bun install

# ---------- Stage 4: runner ----------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Puerto de producción configurable; el proxy de Dokploy mapea a este puerto.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# El schema engine de Prisma es un binario nativo enlazado contra libssl;
# node:slim no lo trae. ca-certificates por si la CLI necesita salir a red.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Usuario sin privilegios: el contenedor nunca corre como root.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Solo se copia el output standalone (binario mínimo) + assets estáticos y
# públicos. No se arrastra el árbol completo de node_modules ni el código fuente.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# El trazado de Next copia los paquetes @img de sharp sin la librería nativa
# libvips (.so), que el binario carga por ruta y no por `require`. Se copian
# completos desde el builder (misma plataforma que la imagen final).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

# Árbol de migraciones aislado en /app/migrate: CLI + schema + migraciones +
# config. Va en su propio directorio para no mezclar su node_modules con el
# del standalone (prisma.config.ts resuelve `prisma/config` desde aquí).
COPY --from=migrate --chown=nextjs:nodejs /migrate/node_modules ./migrate/node_modules
COPY --chown=nextjs:nodejs prisma/schema ./migrate/prisma/schema
COPY --chown=nextjs:nodejs prisma/migrations ./migrate/prisma/migrations
COPY --chown=nextjs:nodejs prisma.config.ts ./migrate/prisma.config.ts
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# El entrypoint aplica las migraciones pendientes y después ejecuta CMD.
# El servidor standalone de Next lee PORT/HOSTNAME del entorno.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
