import 'server-only';
import { prisma } from '@/server/db/prisma';
import { getBalance } from '@/server/billing/credit-balance-repo';
import { MODEL_USE_GUIDE } from '@/lib/ai-model-guide';
import { fail } from '@/server/errors/run-action';
import type { OrgContext } from '@/server/auth/org-context';
import { canManageAiKeys, listOrganizationAiKeys } from './organization-ai-keys';

const ROLE_LABELS = { owner: 'Propietario', admin: 'Administrador', member: 'Miembro' } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProfileSummary {
  user: { name: string; email: string; createdAt: string; platformAdmin: boolean };
  organization: { name: string; role: string; members: number; canEdit: boolean };
  projects: number;
  credits: number;
  keys: { configured: number; total: number; providers: string[] };
  models: { customized: number; total: number };
  usage: { calls: number; failed: number; costUsd: number };
}

/** Datos del resumen de «Mi perfil», todos de la organización del contexto. */
export async function getProfileSummary(ctx: OrgContext): Promise<ProfileSummary> {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const [user, organization, members, projects, credits, keys, customized, usage] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { name: true, email: true, createdAt: true, role: true } }),
    prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { name: true } }),
    prisma.member.count({ where: { organizationId: ctx.organizationId } }),
    prisma.project.count({ where: { organizationId: ctx.organizationId, deletedAt: null } }),
    getBalance(ctx.organizationId),
    listOrganizationAiKeys(ctx),
    prisma.organizationModelRoute.findMany({ where: { organizationId: ctx.organizationId, position: 0 }, select: { action: true } }),
    prisma.aiRequestCost.groupBy({ by: ['status'], where: { organizationId: ctx.organizationId, createdAt: { gte: since } }, _count: { _all: true }, _sum: { costUsd: true } }),
  ]);
  const configured = keys.filter((key) => key.configured);
  return {
    user: { name: user.name, email: user.email, createdAt: user.createdAt.toISOString(), platformAdmin: user.role === 'admin' },
    organization: { name: organization.name, role: ROLE_LABELS[ctx.role], members, canEdit: canManageAiKeys(ctx) },
    projects,
    credits,
    keys: { configured: configured.length, total: keys.length, providers: configured.map((key) => key.label) },
    models: { customized: customized.length, total: MODEL_USE_GUIDE.length },
    usage: {
      calls: usage.reduce((sum, row) => sum + row._count._all, 0),
      failed: usage.filter((row) => row.status !== 'success').reduce((sum, row) => sum + row._count._all, 0),
      costUsd: usage.reduce((sum, row) => sum + Number(row._sum.costUsd ?? 0), 0),
    },
  };
}

export interface OrganizationMemberView { name: string; email: string; role: string; you: boolean }

export async function getOrganizationDetails(ctx: OrgContext) {
  const [organization, members] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { name: true, createdAt: true } }),
    prisma.member.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: 'asc' },
      select: { role: true, userId: true, user: { select: { name: true, email: true } } } }),
  ]);
  return {
    name: organization.name,
    createdAt: organization.createdAt.toISOString(),
    canEdit: canManageAiKeys(ctx),
    members: members.map((member): OrganizationMemberView => ({ name: member.user.name, email: member.user.email,
      role: ROLE_LABELS[member.role === 'owner' || member.role === 'admin' ? member.role : 'member'], you: member.userId === ctx.userId })),
  };
}

export async function renameOrganization(ctx: OrgContext, rawName: string): Promise<void> {
  if (!canManageAiKeys(ctx)) fail('Solo el propietario o un administrador puede cambiar el nombre de la organización.');
  const name = rawName.trim();
  if (name.length < 2 || name.length > 80) fail('El nombre debe tener entre 2 y 80 caracteres.');
  await prisma.organization.update({ where: { id: ctx.organizationId }, data: { name } });
}
