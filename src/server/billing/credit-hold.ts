/**
 * Reservas de crédito como máquina de estados (`credit_hold`).
 *
 * Implementa la semántica del contrato de débito de F0 sobre el saldo
 * autoritativo. La idempotencia es por OPERACIÓN: la misma `idempotencyKey`
 * reaplicada devuelve el estado existente sin volver a efectuar nada, de modo que
 * reintentos, regeneraciones y reenvíos de webhook no producen doble cobro.
 *
 * Transiciones válidas: PENDING → {SETTLED | REVERTED | EXPIRED}. Los tres son
 * terminales; en particular, hacer `settle` tras `revert` se rechaza.
 */
import type { HoldState } from '@/generated/prisma/client';
import { prisma } from '@/server/db/prisma';
import { credit, debit, InsufficientCreditsError } from './credit-balance-repo';

export { InsufficientCreditsError };

export class InvalidHoldTransitionError extends Error {
  constructor(
    public readonly idempotencyKey: string,
    public readonly from: HoldState,
    public readonly to: HoldState,
  ) {
    super(`Transición inválida de hold ${idempotencyKey}: ${from} → ${to}`);
    this.name = 'InvalidHoldTransitionError';
  }
}

export interface Hold {
  idempotencyKey: string;
  organizationId: string;
  amount: number;
  state: HoldState;
}

export interface HoldRequest {
  idempotencyKey: string;
  organizationId: string;
  amount: number;
  refType: string;
  refId: string;
  /** Minutos hasta que el reaper pueda revertir un hold PENDING huérfano. */
  ttlMinutes?: number;
}

const DEFAULT_TTL_MINUTES = 30;

/**
 * Reserva créditos. Descuenta del saldo autoritativo y registra el hold en
 * estado PENDING, todo en una transacción. Reaplicar la misma `idempotencyKey`
 * devuelve el hold existente sin volver a descontar.
 */
export async function hold(req: HoldRequest): Promise<Hold> {
  const existing = await prisma.creditHold.findUnique({
    where: { idempotencyKey: req.idempotencyKey },
  });
  if (existing) {
    return toHold(existing);
  }

  const expiresAt = new Date(Date.now() + (req.ttlMinutes ?? DEFAULT_TTL_MINUTES) * 60_000);

  try {
    const created = await prisma.$transaction(async (tx) => {
      // El débito bloquea el saldo y verifica fondos antes de crear el hold.
      await debit(req.organizationId, req.amount, 'hold', {
        tx,
        refId: req.refId,
      });
      return tx.creditHold.create({
        data: {
          idempotencyKey: req.idempotencyKey,
          organizationId: req.organizationId,
          amount: req.amount,
          state: 'PENDING',
          refType: req.refType,
          refId: req.refId,
          expiresAt,
        },
      });
    });
    return toHold(created);
  } catch (err) {
    // Carrera: otra petición con la misma clave creó el hold entre el lookup y
    // el insert. Devolvemos el que ganó (idempotencia), sin doble efecto.
    if (isUniqueViolation(err)) {
      const winner = await prisma.creditHold.findUnique({
        where: { idempotencyKey: req.idempotencyKey },
      });
      if (winner) return toHold(winner);
    }
    throw err;
  }
}

/** Confirma el cobro: PENDING → SETTLED. El crédito ya se descontó en `hold`. */
export async function settle(idempotencyKey: string): Promise<Hold> {
  return transition(idempotencyKey, 'SETTLED', async (tx, current) => {
    // El saldo ya se debitó al reservar; confirmar no mueve el saldo, solo cierra
    // el hold y deja constancia en el ledger.
    await tx.creditLedger.create({
      data: {
        organizationId: current.organizationId,
        delta: 0,
        reason: 'settle',
        refId: idempotencyKey,
        holdId: current.id,
      },
    });
  });
}

/** Libera la reserva sin cobrar: PENDING → REVERTED. Repone el saldo. */
export async function revert(idempotencyKey: string): Promise<Hold> {
  return transition(idempotencyKey, 'REVERTED', async (tx, current) => {
    await credit(current.organizationId, current.amount, 'revert', {
      tx,
      refId: idempotencyKey,
      holdId: current.id,
    });
  });
}

/**
 * Reaper de holds huérfanos: pasa a EXPIRED los holds PENDING cuyo `expiresAt`
 * venció (proceso muerto entre `hold` y `settle`/`revert`) y repone su saldo. No
 * toca holds vigentes ni terminales. Devuelve cuántos revirtió.
 */
export async function reapExpiredHolds(now: Date = new Date()): Promise<number> {
  const orphans = await prisma.creditHold.findMany({
    where: { state: 'PENDING', expiresAt: { lt: now } },
    select: { id: true, idempotencyKey: true },
  });

  let reaped = 0;
  for (const orphan of orphans) {
    try {
      await transition(orphan.idempotencyKey, 'EXPIRED', async (tx, current) => {
        await credit(current.organizationId, current.amount, 'expire', {
          tx,
          refId: current.idempotencyKey,
          holdId: current.id,
        });
      });
      reaped += 1;
    } catch (err) {
      // Si otra transición ganó la carrera (settle/revert simultáneo), se ignora.
      if (!(err instanceof InvalidHoldTransitionError)) throw err;
    }
  }
  return reaped;
}

// --- internos ---

interface HoldRow {
  id: string;
  idempotencyKey: string;
  organizationId: string;
  amount: number;
  state: HoldState;
}

async function transition(
  idempotencyKey: string,
  to: Exclude<HoldState, 'PENDING'>,
  effect?: (
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    current: HoldRow,
  ) => Promise<void>,
): Promise<Hold> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.creditHold.findUnique({ where: { idempotencyKey } });
    if (!current) {
      throw new InvalidHoldTransitionError(idempotencyKey, 'PENDING', to);
    }
    // Reaplicar la transición ya alcanzada es idempotente: devuelve sin re-efecto.
    if (current.state === to) {
      return toHold(current);
    }
    // Solo se sale de PENDING; cualquier otro origen es un estado terminal.
    if (current.state !== 'PENDING') {
      throw new InvalidHoldTransitionError(idempotencyKey, current.state, to);
    }
    if (effect) {
      await effect(tx, current);
    }
    const updated = await tx.creditHold.update({
      where: { idempotencyKey },
      data: { state: to },
    });
    return toHold(updated);
  });
}

function toHold(row: HoldRow): Hold {
  return {
    idempotencyKey: row.idempotencyKey,
    organizationId: row.organizationId,
    amount: row.amount,
    state: row.state,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}
