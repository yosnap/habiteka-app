/**
 * Vista de una sala de votación abierta por su enlace. Carga los elementos
 * votables del entregable asociado y monta la sala (que sondea el estado en vivo).
 * Interactuar requiere sesión; el guardia de las acciones lo aplica.
 */
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db/prisma';
import { votableElementsFrom } from '@/addons/voting/server/room-repo';
import { VotingRoom } from '@/addons/voting/ui/voting-room';
import type { DesignElement } from '@/lib/contracts';

interface Props {
  params: Promise<{ roomId: string }>;
}

export default async function VotingRoomPage({ params }: Props) {
  const { roomId } = await params;
  const room = await prisma.votingRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      title: true,
      project: {
        select: {
          deliverables: { take: 1, orderBy: { createdAt: 'desc' }, select: { payload: true } },
        },
      },
    },
  });
  if (!room) notFound();

  // Los elementos votables viven en el payload del entregable (el agente los
  // extrae al generarlo); la sala los presenta sin reescanear el diseño.
  const payload = room.project.deliverables[0]?.payload as
    | { elements?: DesignElement[] }
    | undefined;
  const elements = votableElementsFrom(payload?.elements);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold tracking-tight">{room.title}</h1>
      <VotingRoom roomId={room.id} elements={elements} />
    </main>
  );
}
