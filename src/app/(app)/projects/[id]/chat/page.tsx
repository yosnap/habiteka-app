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
  searchParams: Promise<{ zona?: string }>;
}

export default async function ChatPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { zona } = await searchParams;
  const zoneId = zona ?? null;
  // El layout del proyecto ya validó la sesión y la pertenencia. Se lee la fase
  // persistida de ESTA zona para que el asistente arranque donde la zona se quedó
  // (estado por zona; zona null = flujo por defecto del proyecto). `findFirst` porque la
  // unicidad por (proyecto, zona) la dan índices parciales, no una clave compuesta simple.
  const state = await prisma.agentState.findFirst({
    where: { projectId: id, zoneId },
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
        <QualificationChat
          projectId={id}
          advance={advanceAgent}
          initialPhase={initialPhase}
          zoneId={zoneId}
        />
      </div>
    </main>
  );
}
