import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { assertTestDatabaseUrl } from './src/server/db/test-database-guard';

// Carga las variables locales (DATABASE_URL) para los tests de integración que
// corren contra una Postgres real. En CI, DATABASE_URL llega del entorno del job.
loadEnv({ path: ['.env.local', '.env'] });
assertTestDatabaseUrl(process.env.DATABASE_URL);
process.env.HABITEKA_TEST_RUN = '1';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // Los tests de integración comparten una base de datos; ejecutarlos en serie
    // evita que el truncado de tablas de un archivo pise a otro.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
