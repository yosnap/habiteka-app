import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/prisma';

describe('isolated adapter preserves Prisma transactions', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('supports raw queries and interactive transactions after marker validation', async () => {
    const rows = await prisma.$transaction(
      async (tx) => tx.$queryRaw<Array<{ value: number }>>`SELECT 1::int AS value`,
    );
    expect(rows).toEqual([{ value: 1 }]);
  });

  it('supports batch transactions without extra connections inside the transaction', async () => {
    const rows = await prisma.$transaction([
      prisma.$queryRaw<Array<{ value: number }>>`SELECT 2::int AS value`,
      prisma.$queryRaw<Array<{ value: number }>>`SELECT 3::int AS value`,
    ]);
    expect(rows).toEqual([[{ value: 2 }], [{ value: 3 }]]);
  });
});
