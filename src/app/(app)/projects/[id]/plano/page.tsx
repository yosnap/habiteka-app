/**
 * Estudio de planos del proyecto: superficie limpia del pivote planos-IA
 * (boceto → plano técnico → imagen cenital), independiente del editor legacy.
 * El layout del proyecto ya validó sesión y pertenencia; las Server Actions
 * reaplican el ámbito por organización.
 */
import {
  extractPlanFromRedrawn,
  generateCenitalFromRedrawn,
  redrawPlanFromImage,
  sendPlanoToEditor,
} from '../_actions/agent-actions';
import { PlanoStudio } from '@/components/plano-studio/plano-studio';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlanoStudioPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="h-[calc(100vh-7rem)]">
      <PlanoStudio
        projectId={id}
        redrawAction={redrawPlanFromImage}
        extractAction={extractPlanFromRedrawn}
        cenitalAction={generateCenitalFromRedrawn}
        sendToEditorAction={sendPlanoToEditor}
      />
    </main>
  );
}
