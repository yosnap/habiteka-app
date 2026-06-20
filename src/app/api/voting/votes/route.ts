/**
 * Emite o actualiza un voto. Requiere sesión: votar no es anónimo. El usuario de
 * la sesión es el votante, de modo que no se puede votar en nombre de otro.
 */
import { NextResponse } from 'next/server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { castVote } from '@/addons/voting/server/vote-service';

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireOrgContext();
  const body = (await request.json()) as { roomId?: string; targetRef?: string; value?: number };
  if (!body.roomId || !body.targetRef || typeof body.value !== 'number') {
    return NextResponse.json({ error: 'payload incompleto' }, { status: 400 });
  }
  await castVote({
    votingRoomId: body.roomId,
    targetRef: body.targetRef,
    voterId: ctx.userId,
    value: body.value,
  });
  return NextResponse.json({ ok: true });
}
