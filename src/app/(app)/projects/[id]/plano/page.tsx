/**
 * Estudio de planos del proyecto: superficie limpia del pivote planos-IA
 * (boceto → plano técnico → imagen cenital), independiente del editor legacy.
 * El layout del proyecto ya validó sesión y pertenencia; las Server Actions
 * reaplican el ámbito por organización.
 */
import { sendPlanoToEditor } from '../_actions/agent-actions';
import {
  redrawStudio,
  extractStudio,
  cenitalStudio,
  importCanvasStudio,
  scaleStudio,
  drawingStudio,
  uploadStudio,
} from '../_actions/studio-actions';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { loadStudio } from '@/server/plan/studio-repo';
import { PlanoStudio } from '@/components/plano-studio/plano-studio';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlanoStudioPage({ params }: Props) {
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
