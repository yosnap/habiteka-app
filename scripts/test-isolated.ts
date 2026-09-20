import { spawnSync } from 'node:child_process';
import { assertTestDatabaseUrl } from '../src/server/db/test-database-guard';

try {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  const result = spawnSync('bunx', ['vitest', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', HABITEKA_TEST_RUN: '1' },
  });
  if (result.error) throw new Error('No se pudo iniciar Vitest.');
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Pruebas bloqueadas.');
  process.exitCode = 1;
}
