/**
 * Vista del chat de cualificación de un proyecto. Resuelve la organización de la
 * sesión, verifica la pertenencia del proyecto y monta el chat, que dispara las
 * acciones del agente en el servidor.
 */
import { notFound } from 'next/navigation';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { QualificationChat } from '@/components/chat/qualification-chat';
import { advanceAgent } from '../_actions/agent-actions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChatPage({ params }: Props) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const project = await withOrg(ctx).projects.findById(id);
  if (!project) notFound();

  return (
    <main className="mx-auto flex h-[calc(100vh-3rem)] max-w-2xl flex-col gap-3 p-4">
      <h1 className="text-lg font-semibold tracking-tight">{project.title} · Cuéntanos</h1>
      <div className="min-h-0 flex-1">
        <QualificationChat projectId={id} advance={advanceAgent} />
      </div>
    </main>
  );
}
