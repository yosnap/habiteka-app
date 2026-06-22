/**
 * Vista del chat de cualificación de un proyecto. Resuelve la organización de la
 * sesión, verifica la pertenencia del proyecto y monta el chat, que dispara las
 * acciones del agente en el servidor.
 */
import { prisma } from '@/server/db/prisma';
import { QualificationChat } from '@/components/chat/qualification-chat';
import { advanceAgent } from '../_actions/agent-actions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChatPage({ params }: Props) {
  const { id } = await params;
  // El layout del proyecto ya validó la sesión y la pertenencia. Se lee la fase
  // persistida para que el asistente arranque donde el proyecto se quedó.
  const state = await prisma.agentState.findUnique({
    where: { projectId: id },
    select: { phase: true },
  });
  const initialPhase = (state?.phase ?? 'ingesta') as
    | 'ingesta'
    | 'cualificacion'
    | 'entrega'
    | 'feedback';
  return (
    <main className="mx-auto flex h-[calc(100vh-7rem)] max-w-2xl flex-col gap-3 p-4">
      <p className="text-ink-soft text-sm">
        Sube una foto o un boceto de tu espacio y cuéntame qué quieres conseguir.
      </p>
      <div className="min-h-0 flex-1">
        <QualificationChat projectId={id} advance={advanceAgent} initialPhase={initialPhase} />
      </div>
    </main>
  );
}
