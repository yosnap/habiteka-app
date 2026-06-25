import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

// Carga las variables locales (DATABASE_URL) para los tests de integración que
// corren contra una Postgres real. En CI, DATABASE_URL llega del entorno del job.
loadEnv({ path: ['.env.local', '.env'] });

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
