import { describe, it, expect, beforeEach } from 'vitest';
import {
  usageByAction,
  activeUsers,
  creditsConsumedByOrg,
} from '@/server/admin/analytics/usage-queries';
import { emitUsageEvent } from '@/server/analytics/usage-emitter';
import { listAuditLog, userCreations } from '@/server/admin/analytics/audit-queries';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg } from '../helpers/db';

const RANGE = { from: new Date('2026-01-01'), to: new Date('2027-01-01') };

describe('usage-queries (analítica read-only)', () => {
  beforeEach(resetDb);

  it('agrega por acción y unidad sin mezclar tokens con imágenes', async () => {
    await emitUsageEvent({
      action: 'chat',
      unit: 'token',
      amount: 1000,
      costUsd: 0.01,
      userId: 'u1',
    });
    await emitUsageEvent({
      action: 'chat',
      unit: 'token',
      amount: 500,
      costUsd: 0.005,
      userId: 'u1',
    });
    await emitUsageEvent({
      action: 'render3d',
      unit: 'image',
      amount: 1,
      costUsd: 0.04,
      userId: 'u2',
    });

    const rows = await usageByAction(RANGE);
    const chatTokens = rows.find((r) => r.action === 'chat' && r.unit === 'token');
    const render = rows.find((r) => r.action === 'render3d' && r.unit === 'image');

    expect(chatTokens?.totalAmount).toBe(1500); // 1000 + 500 tokens
    expect(chatTokens?.events).toBe(2);
    expect(render?.unit).toBe('image');
    expect(render?.totalAmount).toBe(1); // imágenes, NO sumadas con tokens
  });

  it('cuenta usuarios activos distintos', async () => {
    await emitUsageEvent({ action: 'chat', unit: 'token', amount: 1, costUsd: 0, userId: 'u1' });
    await emitUsageEvent({ action: 'chat', unit: 'token', amount: 1, costUsd: 0, userId: 'u1' });
    await emitUsageEvent({ action: 'chat', unit: 'token', amount: 1, costUsd: 0, userId: 'u2' });
    expect(await activeUsers(RANGE)).toBe(2);
  });

  it('reporta los créditos consumidos (delta negativo) por organización', async () => {
    const org = await makeOrg(0);
    await prisma.creditLedger.createMany({
      data: [
        { organizationId: org, delta: -10, reason: 'hold' },
        { organizationId: org, delta: -5, reason: 'hold' },
        { organizationId: org, delta: 100, reason: 'purchase' }, // ingreso, no consumo
      ],
    });
    const rows = await creditsConsumedByOrg(RANGE);
    expect(rows.find((r) => r.organizationId === org)?.consumed).toBe(15);
  });

  it('las consultas de analítica no mutan el ledger', async () => {
    const org = await makeOrg(0);
    await prisma.creditLedger.create({ data: { organizationId: org, delta: -10, reason: 'hold' } });
    const before = await prisma.creditLedger.count();
    await creditsConsumedByOrg(RANGE);
    expect(await prisma.creditLedger.count()).toBe(before);
  });
});

describe('audit-queries', () => {
  beforeEach(resetDb);

  it('lista las entradas de auditoría más recientes', async () => {
    await prisma.auditLog.create({
      data: { actorId: 'a1', action: 'ban_user', targetType: 'user', targetId: 'u1' },
    });
    const { entries, total } = await listAuditLog({ page: 1, pageSize: 10 });
    expect(total).toBe(1);
    expect(entries[0]?.action).toBe('ban_user');
  });

  it('resume las creaciones de una organización (metadatos)', async () => {
    const org = await makeOrg(0);
    const project = await prisma.project.create({ data: { organizationId: org, title: 'P' } });
    await prisma.deliverable.create({
      data: { projectId: project.id, type: 'PLANO_2D', payload: {}, legalSeal: 'x', version: 1 },
    });
    const summary = await userCreations(org);
    expect(summary.projects).toBe(1);
    expect(summary.deliverables).toBe(1);
  });
});
