/**
 * Layout del área autenticada de usuario. Valida la sesión en el SERVIDOR: sin
 * sesión válida redirige a /acceder y nunca renderiza el contenido. Provee la
 * cabecera con el saldo de créditos. Cada Server Action revalida por su cuenta.
 */
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireOrgContext, UnauthenticatedError } from '@/server/auth/require-org-context';
import { getBalance } from '@/server/billing/credit-balance-repo';
import { prisma } from '@/server/db/prisma';
import { AppHeader } from '@/components/app/app-header';

export default async function AppLayout({ children }: { children: ReactNode }) {
  let ctx;
  try {
    ctx = await requireOrgContext();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect('/acceder');
    }
    throw err;
  }

  const [balance, user] = await Promise.all([
    getBalance(ctx.organizationId),
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
  ]);

  return (
    <>
      <AppHeader userName={user?.name} balance={balance} />
      {children}
    </>
  );
}
