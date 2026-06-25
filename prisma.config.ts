import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Carga `.env.local` (dev) y `.env` como respaldo, para que la URL de la base de
// datos esté disponible al ejecutar los comandos de Prisma CLI.
loadEnv({ path: ['.env.local', '.env'] });

// Schema multi-fichero: cada dominio en su `.prisma` bajo `prisma/schema/`.
// En Prisma 7 la URL de conexión para Migrate vive aquí (ya no en el schema);
// el cliente en runtime se conecta vía driver adapter (ver src/server/db/prisma.ts).
export default defineConfig({
  schema: 'prisma/schema',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun run prisma/seed.ts',
  },
});
