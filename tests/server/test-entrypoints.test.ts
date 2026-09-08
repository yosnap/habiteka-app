import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('test entrypoints fail closed', () => {
  it.each([
    ['run', 'test'],
    ['run', 'test:ci'],
    ['run', 'test:watch'],
    ['x', 'vitest', 'run'],
    ['x', 'vitest', '--watch'],
  ])('rejects %j before executing tests', (...args) => {
    const result = spawnSync('bun', args, {
      env: { ...process.env, DATABASE_URL: 'postgresql://localhost:1/habiteka_dev' },
      encoding: 'utf8',
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('no autorizado');
    expect(result.stdout + result.stderr).not.toContain('dev-seed');
  });
});
