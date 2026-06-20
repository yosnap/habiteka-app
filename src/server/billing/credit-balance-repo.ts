/**
 * Saldo autoritativo de créditos.
 *
 * El saldo vive en una fila única por organización (`credit_balance`), NO se
 * deriva de `SUM(credit_ledger)`: bajo varias réplicas, sumar el ledger sin lock
 * permite que dos débitos concurrentes lean el mismo saldo y lo dejen negativo.
 * Aquí el débito bloquea la fila con `SELECT ... FOR UPDATE` dentro de una
 * transacción, de modo que las operaciones concurrentes se serializan en la base
 * de datos (no en un mutex de proceso, inútil con varias instancias).
 */
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db/prisma';

export class InsufficientCreditsError extends Error {
  constructor(public readonly organizationId: string) {
    super(`Saldo insuficiente para la organización ${organizationId}`);
    this.name = 'InsufficientCreditsError';
  }
}

type Tx = Prisma.TransactionClient;

/** Lee el saldo actual (sin bloquear). Para lógica de débito usar `debit`. */
export async function getBalance(organizationId: string): Promise<number> {
  const row = await prisma.creditBalance.findUnique({
    where: { organizationId },
    select: { balance: true },
  });
  return row?.balance ?? 0;
}

/**
 * Debita `amount` créditos de forma segura: bloquea la fila del saldo, verifica
 * que alcanza, decrementa e inserta el movimiento en el ledger — todo en una
 * transacción. Si no alcanza, lanza `InsufficientCreditsError` sin efecto.
 *
 * Acepta un `tx` opcional para componerse dentro de una transacción mayor (p. ej.
 * la reserva de un hold); si no se pasa, abre su propia transacción.
 */
export async function debit(
  organizationId: string,
  amount: number,
  reason: string,
  opts: { tx?: Tx; refId?: string; holdId?: string } = {},
): Promise<number> {
  const run = async (tx: Tx): Promise<number> => {
    // Lock de fila: las transacciones concurrentes esperan aquí y se serializan.
    const locked = await tx.$queryRaw<Array<{ balance: number }>>`
      SELECT "balance" FROM "credit_balance"
      WHERE "organizationId" = ${organizationId}
      FOR UPDATE
    `;
    const current = locked[0]?.balance ?? 0;
    if (current < amount) {
      throw new InsufficientCreditsError(organizationId);
    }
    const updated = await tx.creditBalance.update({
      where: { organizationId },
      data: { balance: { decrement: amount } },
      select: { balance: true },
    });
    await tx.creditLedger.create({
      data: {
        organizationId,
        delta: -amount,
        reason,
        refId: opts.refId,
        holdId: opts.holdId,
      },
    });
    return updated.balance;
  };

  return opts.tx ? run(opts.tx) : prisma.$transaction(run);
}

/**
 * Acredita `amount` créditos (devoluciones, recargas, repón de reaper). Bloquea
 * la fila para no perder incrementos concurrentes y registra el movimiento.
 */
export async function credit(
  organizationId: string,
  amount: number,
  reason: string,
  opts: { tx?: Tx; refId?: string; holdId?: string } = {},
): Promise<number> {
  const run = async (tx: Tx): Promise<number> => {
    await tx.$queryRaw`
      SELECT "balance" FROM "credit_balance"
      WHERE "organizationId" = ${organizationId}
      FOR UPDATE
    `;
    const updated = await tx.creditBalance.update({
      where: { organizationId },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });
    await tx.creditLedger.create({
      data: {
        organizationId,
        delta: amount,
        reason,
        refId: opts.refId,
        holdId: opts.holdId,
      },
    });
    return updated.balance;
  };

  return opts.tx ? run(opts.tx) : prisma.$transaction(run);
}
