/**
 * Estudio de planos del proyecto: superficie limpia del pivote planos-IA
 * (boceto → plano técnico → imagen cenital), independiente del editor legacy.
 * El layout del proyecto ya validó sesión y pertenencia; las Server Actions
 * reaplican el ámbito por organización.
 */
import { sendPlanoToEditor } from '../_actions/agent-actions';
import {
  redrawStudio,
  selectStudioResult,
  startNewStudioPlan,
  cenitalStudio,
  importCanvasStudio,
  drawingStudio,
  uploadStudio,
  setEditorBackgroundStudio,
  importPlanStudio,
  importStudioPlanStudio,
  refitPlanImportStudio,
  applyPlanImportStudio,
} from '../_actions/studio-actions';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { loadStudio, resolveStudioResultViews } from '@/server/plan/studio-repo';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { PlanoStudio } from '@/components/plano-studio/plano-studio';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { deserializeCanvas } from '@/canvas/serialize';
import type { StudioDeliverableView } from '@/components/plano-studio/studio-results-panel';

import type { StudioQuality } from '@/lib/studio-state';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Importación anterior a la puerta de calidad (o guardada sin evaluar): se
 * trata como pendiente de confirmar, nunca como fiable por omisión.
 */
const UNEVALUATED: StudioQuality = {
  score: null,
  decision: 'confirm',
  reasons: ['Este plano se importó sin evaluar su fiabilidad; revísalo antes de seguir.'],
  failOpen: false,
};

export default async function PlanoStudioPage({ params }: Props) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const [initialState, deliverableRows, editor] = await Promise.all([
    loadStudio(ctx, id),
    withOrg(ctx).deliverables.list(id),
    withEditorDocuments(ctx).load({ projectId: id }),
  ]);
  const [initialResults, deliverables] = await Promise.all([
    resolveStudioResultViews(initialState),
    Promise.all(deliverableRows.map(async (row): Promise<StudioDeliverableView> => ({
      id: row.id,
      type: row.type,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      url: row.type === 'RENDER_3D' || row.type === 'VIDEO'
        ? await resolveRenderUrl(row.payload as { assetKey?: string; assetUrl?: string })
        : null,
    }))),
  ]);
  // Extracción de plano dibujado guardada: se recalcula (determinista, sin IA)
  // para que el usuario pueda retomar la tabla de medidas tras recargar.
  const importImage = initialState.planImport?.image ?? initialState.source;
  const initialImport =
    initialState.planImport && importImage
      ? {
          ...buildPlanImport(initialState.planImport.raw, {
            roomOverrides: initialState.planImport.roomOverrides,
            doorOverrides: initialState.planImport.doorOverrides,
            wallOverrides: initialState.planImport.wallOverrides,
            generalWidthMm: initialState.planImport.generalWidthMm,
            includeFurniture: initialState.planImport.includeFurniture,
            normalize: initialState.planImport.detected
              ? {
                  wallsOverride: initialState.planImport.detected.walls,
                  imageHeightOverWidth: initialState.planImport.detected.heightOverWidth,
                }
              : {},
          }),
          imageUrl: importImage.assetUrl,
          // Veredicto de fiabilidad de la última evaluación: se reutiliza sin
          // volver a llamar a Jev (el plano recalculado es el mismo).
          quality: initialState.quality ?? UNEVALUATED,
          revision: initialState.planImportRevision,
          wallOverrides: initialState.planImport.wallOverrides ?? [],
          generalWidthMm: initialState.planImport.generalWidthMm,
          includeFurniture: initialState.planImport.includeFurniture,
        }
      : null;
  // El layout del proyecto ya reserva la cabecera y las pestañas (flex + min-h-0);
  // aquí basta con ocupar el hueco restante en vez de restar un alto fijo.
  return (
    <main className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
      <PlanoStudio
        key={`${id}:${initialState.plan?.assetKey ?? 'sin-plano'}:${initialState.planImportRevision ?? 'sin-revision'}`}
        projectId={id}
        initialState={initialState}
        initialResults={initialResults}
        deliverables={deliverables}
        hasEditorPlan={editor.authority === 'v2'
          ? editor.document.walls.length > 0
          : deserializeCanvas(editor.legacySnapshot).objects.some((item) => item.kind === 'wall')}
        redrawAction={redrawStudio}
        selectResultAction={selectStudioResult}
        startNewAction={startNewStudioPlan}
        drawingAction={drawingStudio}
        uploadAction={uploadStudio}
        cenitalAction={cenitalStudio}
        importCanvasAction={importCanvasStudio}
        editorBackgroundAction={setEditorBackgroundStudio}
        sendToEditorAction={sendPlanoToEditor}
        importAction={importPlanStudio}
        importCurrentAction={importStudioPlanStudio}
        refitAction={refitPlanImportStudio}
        applyAction={applyPlanImportStudio}
        initialImport={initialImport}
        initialGeneralWidthMm={initialState.planImport?.generalWidthMm}
        initialIncludeFurniture={initialState.planImport?.includeFurniture}
      />
    </main>
  );
}
