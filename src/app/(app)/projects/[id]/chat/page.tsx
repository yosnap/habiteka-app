/**
 * Vista del chat de cualificación de un proyecto. Resuelve la organización de la
 * sesión, verifica la pertenencia del proyecto y monta el chat, que dispara las
 * acciones del agente en el servidor.
 */
import { ProjectAssistant } from '@/components/chat/project-assistant';
import { Bot } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zona?: string }>;
}

export default async function ChatPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { zona } = await searchParams;
  const zoneId = zona ?? null;
  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-8">
      <header className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Bot size={24} /></span><div><h1 className="text-xl font-semibold">Asistente de diseño</h1><p className="text-ink-soft text-sm">Una foto, un plano o una idea. Te acompañamos paso a paso.</p></div></header>
      <div className="min-h-0 flex-1 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <ProjectAssistant projectId={id} zoneId={zoneId} />
      </div>

    </main>
  );
}
