import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg, uniqueSuffix } from '../helpers/db';

describe('Invariantes de base de datos', () => {
  beforeEach(resetDb);

  it('un solo acreditado de bienvenida por organización (índice parcial)', async () => {
    const org = await makeOrg();
    await prisma.creditLedger.create({
      data: { organizationId: org, delta: 100, reason: 'welcome_grant' },
    });
    // Un segundo welcome_grant para la misma org debe violar el índice parcial.
    await expect(
      prisma.creditLedger.create({
        data: { organizationId: org, delta: 100, reason: 'welcome_grant' },
      }),
    ).rejects.toThrow();
  });

  it('otros movimientos del ledger no están limitados por el índice parcial', async () => {
    const org = await makeOrg();
    await prisma.creditLedger.create({ data: { organizationId: org, delta: -10, reason: 'hold' } });
    await prisma.creditLedger.create({ data: { organizationId: org, delta: -10, reason: 'hold' } });
    const count = await prisma.creditLedger.count({ where: { organizationId: org } });
    expect(count).toBe(2);
  });

  it('audit_log es append-only: UPDATE y DELETE se rechazan', async () => {
    const log = await prisma.auditLog.create({
      data: {
        actorId: `a-${uniqueSuffix()}`,
        action: 'ban_user',
        targetType: 'user',
        targetId: 'u1',
      },
    });
    await expect(
      prisma.auditLog.update({ where: { id: log.id }, data: { action: 'tampered' } }),
    ).rejects.toThrow();
    await expect(prisma.auditLog.delete({ where: { id: log.id } })).rejects.toThrow();
  });

  it('usage_event es append-only: UPDATE y DELETE se rechazan', async () => {
    const ev = await prisma.usageEvent.create({
      data: { action: 'chat', unit: 'token', amount: 1200, cost: '0.018000' },
    });
    await expect(
      prisma.usageEvent.update({ where: { id: ev.id }, data: { amount: 0 } }),
    ).rejects.toThrow();
    await expect(prisma.usageEvent.delete({ where: { id: ev.id } })).rejects.toThrow();
  });

  it('CanvasState.data persiste como jsonb consultable', async () => {
    const org = await makeOrg();
    const project = await prisma.project.create({ data: { organizationId: org, title: 'P' } });
    await prisma.canvasState.create({
      data: { projectId: project.id, data: { shapes: [{ type: 'rect', x: 1 }] } },
    });
    const rows = await prisma.$queryRawUnsafe<Array<{ t: string }>>(
      `SELECT "data"->'shapes'->0->>'type' AS t FROM "canvas_state" WHERE "projectId" = '${project.id}'`,
    );
    expect(rows[0]?.t).toBe('rect');
  });
});
