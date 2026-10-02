/**
 * Vista del chat de cualificación de un proyecto. Resuelve la organización de la
 * sesión, verifica la pertenencia del proyecto y monta el chat, que dispara las
 * acciones del agente en el servidor.
 */
import type { ComponentProps } from 'react';
import { prisma } from '@/server/db/prisma';
import { QualificationChat } from '@/components/chat/qualification-chat';
import { PlanReviewPanel } from '@/components/chat/plan-review-panel';
import { advanceAgent } from '../_actions/agent-actions';
import { Bot, CheckCheck } from 'lucide-react';

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
    select: { phase: true, collected: true },
  });
  // Lo ya elegido (estilo, entregables, objetivo, detección) para rehidratar el asistente.
  const collected = (state?.collected ?? {}) as ComponentProps<typeof QualificationChat>['initialCollected'];
  const initialPhase = (state?.phase ?? 'ingesta') as
    | 'ingesta'
    | 'cualificacion'
    | 'entrega'
    | 'feedback';
  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-8">
      <header className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Bot size={24} /></span><div><h1 className="text-xl font-semibold">Asistente de diseño</h1><p className="text-ink-soft text-sm">Una foto, un plano o una idea. Te acompañamos paso a paso.</p></div></header>
      <div className="min-h-0 flex-1 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <QualificationChat
          projectId={id}
          advance={advanceAgent}
          initialPhase={initialPhase}
          zoneId={zoneId}
          initialCollected={collected}
        />
      </div>
      <details className="rounded-xl border border-line px-4 py-3 text-sm"><summary className="flex cursor-pointer items-center gap-2 text-ink-soft"><CheckCheck size={18} />Revisar un plano que ya has dibujado</summary><div className="mt-3"><PlanReviewPanel projectId={id} zoneId={zoneId} /></div></details>
    </main>
  );
}
