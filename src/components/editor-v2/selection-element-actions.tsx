'use client';
import { Copy, RotateCw } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { planObjects, isBoundary, isLegacyBoundary } from '@/lib/editor-document/boundary-types';
import { addBoundaryGate } from '@/lib/editor-document/boundary-commands';
import { assertOpeningClearance, fillWallWithOpening } from '@/lib/editor-document/opening-clearance';
import { editDocument } from '@/canvas/editor-v2/editing-operations';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { PropertySection } from './property-section';
import styles from './selection-properties.module.css';

export function SelectionElementActions({ store, edit }: {
  store: EditorStore; edit: (operation: (document: EditorDocument) => EditorDocument) => boolean;
}) {
  const state = store.getState(), id = state.selection[0];
  if (!id || state.selection.length !== 1) return null;
  const opening = state.document.openings.find((item) => item.id === id);
  const furniture = planObjects(state.document).find((item) => item.id === id);
  const spatial = furniture || state.document.ramps?.some((item) => item.id === id) || state.document.columns?.some((item) => item.id === id);
  if (!opening && !spatial) return null;
  return <PropertySection title="Acciones del elemento">
    <div className={styles.actions}>
      {spatial && <button type="button" onClick={() => state.copySpatial(id)}><Copy size={16} aria-hidden="true" />Copiar</button>}
      {furniture && <button type="button" onClick={() => edit((doc) => updateFurniture(doc, id, { rotation: (furniture.rotation + 90) % 360 }))}>
        <RotateCw size={16} aria-hidden="true" />Girar 90°</button>}
      {furniture && (isBoundary(furniture) || isLegacyBoundary(furniture)) && <button type="button" onClick={() => edit((doc) => addBoundaryGate(doc, id))}>Añadir puerta</button>}
      {opening && <>
        <button type="button" onClick={() => state.copyOpening(id)}>Copiar y colocar</button>
        <button type="button" onClick={() => edit((doc) => editDocument(doc, (next) => {
          const target = next.openings.find((item) => item.id === id)!;
          target.position = .5; assertOpeningClearance(next, target);
        }))}>Centrar en la pared</button>
        <button type="button" onClick={() => edit((doc) => fillWallWithOpening(doc, id))}>Ocupar todo el muro</button>
      </>}
    </div>
    {spatial && <p>Pega con Ctrl/Cmd + V y pulsa en el plano para colocar la copia.</p>}
  </PropertySection>;
}
