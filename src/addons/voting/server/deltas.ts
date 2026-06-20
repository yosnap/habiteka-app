/**
 * Lectura incremental del estado de una sala para el sondeo de la UI.
 *
 * En lugar de recargar toda la sala cada par de segundos, se devuelve el recuento
 * de votos actual (agregado, ligero) y SOLO los comentarios creados después de la
 * última marca de tiempo que tiene el cliente. Así el sondeo es barato aunque la
 * sala tenga mucha actividad.
 */
import { prisma } from '@/server/db/prisma';
import { tallyVotes, type VoteTally } from './vote-service';

export interface RoomDelta {
  tally: VoteTally[];
  newComments: Array<{
    id: string;
    targetRef: string | null;
    authorId: string;
    body: string;
    createdAt: Date;
  }>;
  /** Marca de tiempo del corte, para que el cliente la use en la siguiente llamada. */
  cursor: string;
}

export async function roomDelta(votingRoomId: string, since?: Date): Promise<RoomDelta> {
  const cutoff = new Date();
  const [tally, newComments] = await Promise.all([
    tallyVotes(votingRoomId),
    prisma.comment.findMany({
      where: { votingRoomId, ...(since ? { createdAt: { gt: since } } : {}) },
      orderBy: { createdAt: 'asc' },
      select: { id: true, targetRef: true, authorId: true, body: true, createdAt: true },
    }),
  ]);
  return { tally, newComments, cursor: cutoff.toISOString() };
}
