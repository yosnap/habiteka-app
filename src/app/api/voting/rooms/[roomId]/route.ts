/**
 * Estado incremental de una sala para el sondeo de la UI. Devuelve el recuento de
 * votos y los comentarios nuevos desde la marca de tiempo del cliente (`since`),
 * en lugar de toda la sala, para que el sondeo sea barato.
 */
import { NextResponse } from 'next/server';
import { roomDelta } from '@/addons/voting/server/deltas';

interface Params {
  params: Promise<{ roomId: string }>;
}

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const { roomId } = await params;
  const sinceParam = new URL(request.url).searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : undefined;
  const delta = await roomDelta(roomId, since);
  return NextResponse.json(delta);
}
