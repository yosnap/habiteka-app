'use client';

import { BrainCircuit, CheckCheck, Download, Eye, Footprints, Lightbulb, Type } from 'lucide-react';
import type { EditorSidePanel, EditorStore } from '@/canvas/editor-v2/store';
import type { EditorShellProps } from '../editor-shell';
import type { SceneLightingPreset } from '../scene/scene-lighting';
import { VisibilityMenu, type EditorVisibility } from '../visibility-menu';
import { SelectByKindMenu } from '../select-by-kind-menu';
import { ExteriorRoofPanel } from '../exterior-roof-panel';
import { PropertyOrientationPanel } from '../property-orientation-panel';
import { GeographicSitePanel } from '../geographic-site-panel';
import type { useRoofWorkflow } from '../use-roof-workflow';

interface Props extends Pick<
  EditorShellProps,
  | 'projectId'
  | 'videoResultsHref'
  | 'onExport'
  | 'onApproveDesign'
  | 'onOpenApproved'
  | 'approveDisabled'
  | 'approveLabel'
> {
  store: EditorStore;
  onAddText: () => void;
  readOnly: boolean;
  visibility: EditorVisibility;
  onVisibilityChange: (value: EditorVisibility) => void;
  shortcutsEnabled: boolean;
  onShortcutsChange: (value: boolean) => void;
  sidePanel: EditorSidePanel | null;
  selectedLuminaire: boolean;
  openPanel: (panel: EditorSidePanel) => void;
  togglePanel: (panel: EditorSidePanel) => void;
  closePanel: () => void;
  roofWorkflow: ReturnType<typeof useRoofWorkflow>;
  sceneLighting: SceneLightingPreset;
  onLightingChange: (preset: SceneLightingPreset) => void;
}

/** Un único conjunto de controles, en el menú original 2D o el panel espacial. */
export function EditorPreparationTools({
  onAddText,
  store,
  readOnly,
  visibility,
  onVisibilityChange,
  shortcutsEnabled,
  onShortcutsChange,
  sidePanel,
  selectedLuminaire,
  openPanel,
  togglePanel,
  closePanel,
  roofWorkflow,
  sceneLighting,
  onLightingChange,
  projectId,
  videoResultsHref,
  onExport,
  onApproveDesign,
  onOpenApproved,
  approveDisabled,
  approveLabel,
}: Props) {
  return (
    <>
      <button type="button" disabled={readOnly} onClick={onAddText}><Type size={18} aria-hidden="true" />Añadir texto</button>
      <VisibilityMenu
        value={visibility}
        onChange={onVisibilityChange}
        shortcutsEnabled={shortcutsEnabled}
        onShortcutsChange={onShortcutsChange}
      />
      <SelectByKindMenu
        store={store}
        onSelect={() => {
          if (visibility.roof) onVisibilityChange({ ...visibility, roof: false });
        }}
      />
      <button
        type="button"
        data-side-panel-toggle
        aria-pressed={sidePanel === 'walkthrough'}
        onClick={() => {
          if (sidePanel === 'walkthrough') closePanel();
          else openPanel('walkthrough');
        }}
      >
        <Footprints size={18} aria-hidden="true" />
        {sidePanel === 'walkthrough' ? 'Cerrar panel de recorrido' : 'Recorrido'}
      </button>
      <button
        type="button"
        data-side-panel-toggle
        aria-pressed={sidePanel === 'context'}
        onClick={() => togglePanel('context')}
      >
        <BrainCircuit size={18} aria-hidden="true" />
        Contexto IA
      </button>
      <button
        type="button"
        data-side-panel-toggle
        aria-pressed={sidePanel === 'ceiling'}
        onClick={() => {
          if (sidePanel === 'ceiling' && selectedLuminaire) store.getState().select([]);
          togglePanel('ceiling');
        }}
      >
        <Lightbulb size={18} aria-hidden="true" />
        Techo y luces
      </button>
      <ExteriorRoofPanel
        store={store}
        open={roofWorkflow.open}
        onOpenChange={(open) => { if (open) roofWorkflow.action('configure'); else roofWorkflow.setOpen(false); }}
        onPreview={() => roofWorkflow.action('preview')}
        onEditPlan={() => roofWorkflow.action('edit')}
      />
      <PropertyOrientationPanel
        store={store}
        lighting={sceneLighting}
        onLightingChange={(preset) => {
          onLightingChange?.(preset);
        }}
      />
      {projectId && (
        <GeographicSitePanel
          store={store}
          projectId={projectId}
          readOnly={readOnly}
          approvalDisabled={approveDisabled}
          videoResultsHref={videoResultsHref}
          onOpenApproved={onOpenApproved}
          onReviewApproval={
            onApproveDesign
              ? () => {
                  const light = store.getState().document.geographicSite?.lighting;
                  if (light) onLightingChange?.(light);
                  onApproveDesign();
                }
              : undefined
          }
        />
      )}
      {onExport && (
        <button type="button" onClick={onExport}>
          <Download size={18} aria-hidden="true" />
          <span>Exportar plano</span>
        </button>
      )}
      {projectId && (
        <a
          href={`/api/projects/${projectId}/export`}
          download
          data-project-menu-action
          title="Descarga el proyecto completo como .habiteka para importarlo en otra cuenta o instalación"
        >
          <Download size={18} aria-hidden="true" />
          <span>Exportar proyecto</span>
        </a>
      )}
      {onApproveDesign && (
        <button
          type="button"
          data-project-menu-action
          disabled={approveDisabled}
          onClick={onApproveDesign}
        >
          <CheckCheck size={18} aria-hidden="true" />
          {approveLabel}
        </button>
      )}
      {onOpenApproved && (
        <button type="button" data-project-menu-action onClick={onOpenApproved}>
          <Eye size={18} aria-hidden="true" />
          Ver aprobado
        </button>
      )}
    </>
  );
}
