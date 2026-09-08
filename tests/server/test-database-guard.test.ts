import { describe, expect, it, vi } from 'vitest';
import {
  assertTestDatabaseUrl,
  verifyTestDatabaseMarker,
} from '../../src/server/db/test-database-guard';

describe('test database isolation', () => {
  it.each([
    undefined,
    '',
    'not a URL',
    'postgresql://localhost/habiteka_dev',
    'postgresql://remote.example/habiteka_test',
    'postgresql://localhost/habiteka_test?host=remote.example',
    'postgresql://localhost/habiteka_test?options=-csearch_path=public',
    'https://localhost/habiteka_test',
  ])('rejects unsafe destination without querying: %s', async (url) => {
    const query = vi.fn();
    await expect(verifyTestDatabaseMarker(url, query)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it('accepts a dedicated local test database', () => {
    expect(assertTestDatabaseUrl('postgresql://localhost:1/habiteka_test_guard')).toBe(
      'habiteka_test_guard',
    );
  });
  it('requires the marker and actual database identity', async () => {
    const url = 'postgresql://localhost:1/habiteka_test_guard';
    for (const rows of [
      [],
      [{ database: 'habiteka_dev', marker: 'habiteka-isolated-test-v1' }],
      [{ database: 'habiteka_test_guard', marker: 'wrong' }],
    ]) {
      await expect(verifyTestDatabaseMarker(url, async () => rows)).rejects.toThrow('marcador');
    }
    await expect(
      verifyTestDatabaseMarker(url, async () => [
        { database: 'habiteka_test_guard', marker: 'habiteka-isolated-test-v1' },
      ]),
    ).resolves.toBeUndefined();
  });
  it('never exposes credentials in validation errors', () => {
    try {
      assertTestDatabaseUrl('postgresql://admin:secret@remote/habiteka_dev');
    } catch (error) {
      expect(String(error)).not.toContain('secret');
    }
  });
});
