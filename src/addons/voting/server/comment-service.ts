/**
 * Comentarios sobre los elementos de una sala. El texto se almacena tal cual y se
 * muestra como texto plano (la UI no renderiza HTML crudo), para evitar inyección
 * desde un comentario.
 */
import { prisma } from '@/server/db/prisma';

export interface AddCommentInput {
  votingRoomId: string;
  targetRef?: string;
  authorId: string;
  body: string;
}

export async function addComment(input: AddCommentInput): Promise<{ id: string }> {
  const trimmed = input.body.trim();
  if (!trimmed) throw new Error('El comentario no puede estar vacío');
  const comment = await prisma.comment.create({
    data: {
      votingRoomId: input.votingRoomId,
      targetRef: input.targetRef ?? null,
      authorId: input.authorId,
      body: trimmed,
    },
    select: { id: true },
  });
  return comment;
}

/** Lista los comentarios de una sala (opcionalmente de un elemento concreto). */
export async function listComments(votingRoomId: string, targetRef?: string) {
  return prisma.comment.findMany({
    where: { votingRoomId, ...(targetRef ? { targetRef } : {}) },
    orderBy: { createdAt: 'asc' },
    select: { id: true, targetRef: true, authorId: true, body: true, createdAt: true },
  });
}
