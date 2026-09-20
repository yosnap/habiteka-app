import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const external = vi.hoisted(() => ({
  construct: vi.fn(),
  connect: vi.fn(),
  queryRaw: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {
    constructor() {
      external.construct();
    }
    async connect() {
      external.connect();
      return { queryRaw: external.queryRaw, dispose: external.dispose };
    }
  },
}));
import { TestDatabaseAdapter } from '@/server/db/test-database-adapter';

describe('test adapter connection boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects a development target before constructing the external adapter', () => {
    expect(() => new TestDatabaseAdapter('postgresql://localhost:1/habiteka_dev')).toThrow();
    expect(external.construct).not.toHaveBeenCalled();
    expect(external.connect).not.toHaveBeenCalled();
  });

  it('static Prisma import rejects before constructing a driver', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:1/habiteka_dev');
    vi.resetModules();
    await expect(import('@/server/db/prisma')).rejects.toThrow('no autorizado');
    expect(external.construct).not.toHaveBeenCalled();
  });

  it('does not expose the adapter without a valid database marker', async () => {
    external.queryRaw.mockResolvedValue({ rows: [['habiteka_test_guard', null]] });
    const adapter = new TestDatabaseAdapter('postgresql://localhost:1/habiteka_test_guard');
    await expect(adapter.connect()).rejects.toThrow('marcador');
    expect(external.dispose).toHaveBeenCalledOnce();
    expect(external.queryRaw).toHaveBeenCalledOnce();
  });

  it('disposes the connection when marker query fails', async () => {
    external.queryRaw.mockRejectedValue(new Error('offline'));
    await expect(
      new TestDatabaseAdapter('postgresql://localhost:1/habiteka_test_guard').connect(),
    ).rejects.toThrow('offline');
    expect(external.dispose).toHaveBeenCalledOnce();
  });

  it('captures the URL and validates identity before handing the adapter to Prisma', async () => {
    external.queryRaw.mockResolvedValue({
      rows: [['habiteka_test_guard', 'habiteka-isolated-test-v1']],
    });
    const adapter = new TestDatabaseAdapter('postgresql://localhost:1/habiteka_test_guard');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:1/habiteka_dev');
    await expect(adapter.connect()).resolves.toHaveProperty('queryRaw');
    expect(external.dispose).not.toHaveBeenCalled();
    expect(external.queryRaw.mock.calls[0]?.[0].sql).toContain('shobj_description');
  });
});
