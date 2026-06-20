/**
 * Aprovisionamiento de la organización implícita al registrarse.
 *
 * Cada cuenta nueva recibe una organización propia (la personal es de un solo
 * miembro), su saldo, el acreditado de bienvenida finito y el registro del origen
 * del alta. Todo en una transacción para que no queden estados a medias.
 *
 * Es idempotente: si el usuario ya tiene organización, no hace nada; y aunque se
 * reintente, el índice parcial sobre `welcome_grant` impide un segundo acreditado.
 */
import { prisma } from '@/server/db/prisma';

export interface ProvisionInput {
  userId: string;
  userName: string;
  email: string;
  originIp?: string;
}

export interface ProvisionResult {
  organizationId: string;
  created: boolean;
}

const DEFAULT_WELCOME_CREDITS = 0;

async function readWelcomeCredits(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'welcome_credits' } });
  const value = setting?.value;
  return typeof value === 'number' ? value : DEFAULT_WELCOME_CREDITS;
}

export async function provisionOrganization(input: ProvisionInput): Promise<ProvisionResult> {
  // Si ya es miembro de una organización, el alta ya se aprovisionó.
  const existing = await prisma.member.findFirst({
    where: { userId: input.userId },
    select: { organizationId: true },
  });
  if (existing) {
    return { organizationId: existing.organizationId, created: false };
  }

  const welcomeCredits = await readWelcomeCredits();
  const emailDomain = input.email.split('@')[1] ?? null;

  const organizationId = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        id: `org-${input.userId}`,
        name: input.userName || input.email,
        accountType: 'B2C',
        originEmailDomain: emailDomain,
        originIp: input.originIp ?? null,
        members: {
          create: { id: `mem-${input.userId}`, userId: input.userId, role: 'owner' },
        },
        creditBalance: { create: { balance: welcomeCredits } },
      },
    });

    // El acreditado de bienvenida queda registrado en el ledger; el índice parcial
    // garantiza que solo exista uno por organización (idempotencia ante reintentos).
    if (welcomeCredits > 0) {
      await tx.creditLedger.create({
        data: { organizationId: org.id, delta: welcomeCredits, reason: 'welcome_grant' },
      });
    }

    return org.id;
  });

  return { organizationId, created: true };
}
