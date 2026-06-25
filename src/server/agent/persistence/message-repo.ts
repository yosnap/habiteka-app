/**
 * Persistencia de los turnos de la conversación del agente.
 *
 * Cada proyecto tiene una conversación; cada turno (del usuario o del asistente)
 * se anexa como un mensaje cuyo contenido es serializable. Mantener esto separado
 * del estado de fase deja la traza del diálogo independiente de las transiciones.
 */
import type { MessagePart } from '@/lib/contracts';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db/prisma';

/** Devuelve la conversación del proyecto, creándola si no existe. */
async function ensureConversation(projectId: string): Promise<string> {
  const existing = await prisma.conversation.findFirst({
    where: { projectId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing.id;
  const created = await prisma.conversation.create({ data: { projectId }, select: { id: true } });
  return created.id;
}

export type TurnRole = 'user' | 'assistant' | 'tool';

/** Anexa un turno a la conversación del proyecto. */
export async function appendMessage(
  projectId: string,
  role: TurnRole,
  content: MessagePart[],
): Promise<void> {
  const conversationId = await ensureConversation(projectId);
  await prisma.message.create({
    data: { conversationId, role, content: content as unknown as Prisma.InputJsonValue },
  });
}
