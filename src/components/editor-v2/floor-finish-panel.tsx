'use client';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { FloorFinish } from '@/lib/editor-document/schema';
import { floorFinish, setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { NumberField } from './property-number-field';
import { SurfaceMaterialPicker } from './surface-material-picker';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';

export function FloorFinishPanel({ store }: { store: EditorStore }) {
  const state = useStore(store), id = state.selection[0];
  if (!id?.startsWith('room:') || !deriveRooms(state.document).some((r) => r.id === id)) return null;
  const finish = floorFinish(state.document, id);
  const update = (patch: Partial<FloorFinish>) => {
    try { state.apply(setFloorFinish(store.getState().document, id, patch)); }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo pintar el suelo'); }
  };
  return <section aria-label="Acabados del suelo" style={{ position: 'absolute', right: 20, top: 130, width: 280,
    background: 'white', padding: 20, maxHeight: '65%', overflowY: 'auto', borderRadius: 16, boxShadow: '0 8px 32px #0003', zIndex: 30 }}>
    <strong>Suelo de la habitación</strong>
    <button aria-label="Cerrar acabados del suelo" onClick={() => state.select([])} style={{ float: 'right' }}>×</button>
    <fieldset disabled={state.readOnly} style={{ border: 0, padding: 0, display: 'grid', gap: 12, marginTop: 16 }}>
      <label>Color <input type="color" aria-label="Color del suelo" value={finish.color} onChange={(e) => update({ color: e.target.value })} /></label>
      <label>Textura <select aria-label="Textura del suelo" value={finish.texture} onChange={(e) => update({ texture: e.target.value as FloorFinish['texture'] })}>
        <option value="none">Color liso</option><option value="wood">Madera</option><option value="tile">Baldosas</option>
        {surfaceMaterial(finish.texture) && <option value={finish.texture}>{surfaceMaterial(finish.texture)!.label}</option>}
      </select></label>
      <SurfaceMaterialPicker label="Suelo" value={finish.texture} onChange={(id) => update({
        texture: (id ?? 'none') as FloorFinish['texture'], color: '#ffffff',
        tileSizeMm: surfaceMaterial(id)?.sizeMm[0] ?? 600,
      })} />
      <NumberField label="Tamaño de repetición (cm)" value={finish.tileSizeMm / 10} change={(value) => update({ tileSizeMm: value * 10 })} />
      <NumberField label="Giro de textura (°)" value={finish.rotation} change={(rotation) => update({ rotation })} />
    </fieldset>
  </section>;
}
