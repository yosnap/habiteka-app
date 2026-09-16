/**
 * Estudio de planos del proyecto: superficie limpia del pivote planos-IA
 * (boceto → plano técnico → imagen cenital), independiente del editor legacy.
 * El layout del proyecto ya validó sesión y pertenencia; las Server Actions
 * reaplican el ámbito por organización.
 */
import { sendPlanoToEditor } from '../_actions/agent-actions';
import {
  redrawStudio,
  selectRedrawStudio,
  cenitalStudio,
  importCanvasStudio,
  drawingStudio,
  uploadStudio,
  importPlanStudio,
  importStudioPlanStudio,
  refitPlanImportStudio,
  applyPlanImportStudio,
} from '../_actions/studio-actions';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { loadStudio } from '@/server/plan/studio-repo';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { PlanoStudio } from '@/components/plano-studio/plano-studio';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlanoStudioPage({ params }: Props) {
  const { id } = await params;
  const initialState = await loadStudio(await requireOrgContext(), id);
  // Extracción de plano dibujado guardada: se recalcula (determinista, sin IA)
  // para que el usuario pueda retomar la tabla de medidas tras recargar.
  const importImage = initialState.planImport?.image ?? initialState.source;
  const initialImport =
    initialState.planImport && importImage
      ? {
          ...buildPlanImport(initialState.planImport.raw, {
            normalize: initialState.planImport.detected
              ? {
                  wallsOverride: initialState.planImport.detected.walls,
                  imageHeightOverWidth: initialState.planImport.detected.heightOverWidth,
                }
              : {},
          }),
          imageUrl: importImage.assetUrl,
        }
      : null;
  // El layout del proyecto ya reserva la cabecera y las pestañas (flex + min-h-0);
  // aquí basta con ocupar el hueco restante en vez de restar un alto fijo.
  return (
    <main className="h-full min-h-0 overflow-hidden">
      <PlanoStudio
        key={id}
        projectId={id}
        initialState={initialState}
        redrawAction={redrawStudio}
        selectRedrawAction={selectRedrawStudio}
        drawingAction={drawingStudio}
        uploadAction={uploadStudio}
        cenitalAction={cenitalStudio}
        importCanvasAction={importCanvasStudio}
        sendToEditorAction={sendPlanoToEditor}
        importAction={importPlanStudio}
        importCurrentAction={importStudioPlanStudio}
        refitAction={refitPlanImportStudio}
        applyAction={applyPlanImportStudio}
        initialImport={initialImport}
      />
    </main>
  );
}
