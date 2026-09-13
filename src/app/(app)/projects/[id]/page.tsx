/**
 * Pantalla de un proyecto: carga el estado de estudio en el servidor y monta el
 * workspace nuevo (boceto → plano técnico → cenital). Mantiene el mismo layout de
 * proyecto y el guardado por acciones de server del módulo plano.
 */
import { sendPlanoToEditor } from './_actions/agent-actions';
import {
  redrawStudio,
  extractStudio,
  cenitalStudio,
  importCanvasStudio,
  scaleStudio,
  drawingStudio,
  uploadStudio,
} from './_actions/studio-actions';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { loadStudio } from '@/server/plan/studio-repo';
import { PlanoStudio } from '@/components/plano-studio/plano-studio';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const initialState = await loadStudio(await requireOrgContext(), id);

  return (
    <main className="h-[calc(100vh-7rem)]">
      <PlanoStudio
        key={id}
        projectId={id}
        initialState={initialState}
        redrawAction={redrawStudio}
        drawingAction={drawingStudio}
        uploadAction={uploadStudio}
        extractAction={extractStudio}
        cenitalAction={cenitalStudio}
        importCanvasAction={importCanvasStudio}
        scaleAction={scaleStudio}
        sendToEditorAction={sendPlanoToEditor}
      />
    </main>
  );
}
