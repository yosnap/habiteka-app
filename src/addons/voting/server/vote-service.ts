/**
 * Votos sobre los elementos de una sala. Un usuario tiene un único voto por
 * elemento: votar de nuevo ACTUALIZA el valor en lugar de duplicar (el upsert se
 * apoya en la restricción de unicidad de la base). El recuento se agrega por
 * elemento para mostrarlo en vivo.
 */
import { prisma } from '@/server/db/prisma';

export interface CastVoteInput {
  votingRoomId: string;
  targetRef: string;
  voterId: string;
  value: number;
}

/** Registra o actualiza el voto de un usuario sobre un elemento (idempotente). */
export async function castVote(input: CastVoteInput): Promise<void> {
  await prisma.vote.upsert({
    where: {
      votingRoomId_targetRef_voterId: {
        votingRoomId: input.votingRoomId,
        targetRef: input.targetRef,
        voterId: input.voterId,
      },
    },
    create: {
      votingRoomId: input.votingRoomId,
      targetRef: input.targetRef,
      voterId: input.voterId,
      value: input.value,
    },
    update: { value: input.value },
  });
}

export interface VoteTally {
  targetRef: string;
  total: number;
  votes: number;
}

/** Recuento agregado por elemento (suma de valores y número de votos). */
export async function tallyVotes(votingRoomId: string): Promise<VoteTally[]> {
  const grouped = await prisma.vote.groupBy({
    by: ['targetRef'],
    where: { votingRoomId },
    _sum: { value: true },
    _count: { _all: true },
  });
  return grouped.map((g) => ({
    targetRef: g.targetRef,
    total: g._sum.value ?? 0,
    votes: g._count._all,
  }));
}
