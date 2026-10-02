'use client';
import { AnchoredEditorPanel } from './anchored-editor-panel';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { FloorFinish } from '@/lib/editor-document/schema';
import { floorFinish, setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { MeterField, NumberField } from './property-number-field';
import { SurfaceMaterialPicker } from './surface-material-picker';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { ModernSelect } from '@/components/ui/modern-select';
import { bulkPeers, propagateToPeers } from '@/lib/editor-document/bulk-edit';

export function FloorFinishPanel({ store }: { store: EditorStore }) {
  const state = useStore(store), id = state.selection[0];
  if (state.detailPanel !== 'paint' || !id) return null;
  const roomIds = new Set(deriveRoomsSafe(state.document).map((room) => room.id));
  if (!roomIds.has(id)) return null;
  const selectedCount = state.selection.filter((selectedId) => roomIds.has(selectedId)).length;
  const finish = floorFinish(state.document, id);
  const update = (patch: Partial<FloorFinish>) => {
    // Con varias estancias seleccionadas, el acabado y la cota se aplican a todas.
    try { const current = store.getState().document, next = setFloorFinish(current, id, patch); state.apply(propagateToPeers(current, next, id, bulkPeers(current, id, state.selection))); }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo pintar el suelo'); }
  };
  return <AnchoredEditorPanel store={store} label="Acabados del suelo">
    <strong>{selectedCount > 1 ? `Acabados de ${selectedCount} suelos` : 'Acabados del suelo'}</strong>
    <button aria-label="Cerrar acabados del suelo" onClick={() => state.setDetailPanel(null)} style={{ float: 'right' }}>×</button>
    <fieldset disabled={state.readOnly} style={{ border: 0, padding: 0, display: 'grid', gap: 12, marginTop: 16 }}>
      <label>Color <input type="color" aria-label="Color del suelo" value={finish.color} onChange={(e) => update({ color: e.target.value })} /></label>
      <label>Textura <ModernSelect aria-label="Textura del suelo" value={finish.texture} onChange={(e) => update({ texture: e.target.value as FloorFinish['texture'] })}>
        <option value="none">Color liso</option><option value="wood">Madera</option><option value="tile">Baldosas</option>
        {surfaceMaterial(finish.texture) && <option value={finish.texture}>{surfaceMaterial(finish.texture)!.label}</option>}
      </ModernSelect></label>
      <SurfaceMaterialPicker label="Suelo" value={finish.texture} onChange={(id) => update({
        texture: (id ?? 'none') as FloorFinish['texture'], color: '#ffffff',
        tileSizeMm: surfaceMaterial(id)?.sizeMm[0] ?? 600,
      })} />
      <MeterField label="Cota del suelo" valueMm={finish.elevationMm ?? 0} change={(elevationMm) => update({ elevationMm })} />
      {(finish.elevationMm ?? 0) > 0 && <>
        <MeterField label="Grosor del forjado" valueMm={finish.slabThicknessMm ?? finish.elevationMm!} change={(slabThicknessMm) => update({ slabThicknessMm })} />
        <small style={{ color: '#5d665f' }}>Reducirlo deja espacio para una planta o bodega inferior.</small>
        <label>Color inferior <input type="color" aria-label="Color inferior del forjado" value={finish.undersideColor ?? '#756f66'} onChange={(e) => update({ undersideColor: e.target.value })} /></label>
        <SurfaceMaterialPicker label="Cara inferior y canto del forjado" value={finish.undersideTexture} onChange={(undersideTexture) => update({
          undersideTexture: (undersideTexture ?? 'none') as FloorFinish['texture'],
          undersideColor: undersideTexture ? '#ffffff' : finish.undersideColor,
        })} />
      </>}
      <MeterField label="Tamaño de repetición" valueMm={finish.tileSizeMm} change={(tileSizeMm) => update({ tileSizeMm })} />
      <NumberField label="Giro de textura (°)" value={finish.rotation} change={(rotation) => update({ rotation })} />
    </fieldset>
  </AnchoredEditorPanel>;
}
