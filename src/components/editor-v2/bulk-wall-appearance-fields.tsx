'use client';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { finishColor } from '@/lib/editor-document/spatial-properties';
import { selectedWallSides, updateSelectedWallFaces, type WallFaceTarget } from '@/lib/editor-document/wall-bulk-appearance';
import { SurfaceMaterialPicker } from './surface-material-picker';
import styles from './editor.module.css';

/** Controles de acabado para la selección del menú superior. */
export function BulkWallAppearanceFields({ store, wallIds, facades }: {
  store: EditorStore; wallIds: string[]; facades: boolean;
}) {
  const doc = store.getState().document;
  const first = doc.walls.find((wall) => wall.id === wallIds[0]);
  if (!first || wallIds.length < 2) return null;
  const targets: { key: WallFaceTarget; label: string }[] = facades
    ? [{ key: 'exterior', label: 'Cara exterior' }, { key: 'interior', label: 'Cara interior' }]
    : [{ key: 'both', label: 'Ambas caras' }];
  const apply = (target: WallFaceTarget, patch: { color: string } | { materialId: string | undefined }) => {
    try {
      const state = store.getState();
      state.apply(updateSelectedWallFaces(state.document, wallIds, target, patch));
    } catch (error) {
      store.getState().setError(error instanceof Error ? error.message : 'No se pudo cambiar el acabado.');
    }
  };
  return <div className={styles.bulkWallAppearance}>
    <h3>Acabados de las paredes seleccionadas</h3>
    {targets.map(({ key, label }) => {
      const side = selectedWallSides(doc, first.id, key)[0] ?? 'left';
      const material = first.materials?.[side] ?? 'plaster-white';
      const color = first.colors?.[side] ?? finishColor(material);
      return <div key={key}>
        <label className={styles.field}>{label} · color
          <input type="color" aria-label={`${label} · color`} value={color}
            onChange={(event) => apply(key, { color: event.target.value })} />
        </label>
        <SurfaceMaterialPicker label={`${label} · material`} value={material}
          onChange={(materialId) => apply(key, { materialId })} />
      </div>;
    })}
    <p className={styles.hint}>Los colores y materiales se muestran en la vista 3D.</p>
  </div>;
}
