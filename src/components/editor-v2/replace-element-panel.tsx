'use client';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { replaceFurniture } from '@/lib/editor-document/replace-element';
import { setOpeningType } from '@/lib/editor-document/opening-type-commands';
import { isElementLocked } from '@/lib/editor-document/element-locks';
import { CatalogPanel } from './catalog-panel';
import { OpeningTypeCatalog } from './opening-type-catalog';

export function ReplaceElementPanel({ store }: { store: EditorStore }) {
  const state = useStore(store), id = state.selection.length === 1 ? state.selection[0] : undefined;
  const furniture = state.document.furniture.find(item => item.id === id), opening = state.document.openings.find(item => item.id === id);
  if (!id || (!furniture && !opening)) return <p>Selecciona una pieza desde Escena o Propiedades para sustituirla.</p>;
  const readOnly = state.readOnly || isElementLocked(state.document, id);
  const replace = (operation: () => typeof state.document) => {
    try { state.apply(operation()); state.openSidePanel('inspector'); }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo sustituir el elemento.'); }
  };
  return <>
    <p style={{ padding: '12px 16px' }}>Elige el reemplazo. Se conserva la posición, el giro y el grupo. Si no cabe, se conserva el original.</p>
    {furniture && <CatalogPanel readOnly={readOnly} includeConstruction actionLabel="Sustituir por este modelo"
      onClose={() => state.openSidePanel('inspector')} onAdd={item => replace(() => replaceFurniture(state.document, id, item))} />}
    {opening && opening.kind !== 'hueco' && <OpeningTypeCatalog kind={opening.kind} readOnly={readOnly} replacing
      onChoose={card => replace(() => setOpeningType(state.document, id, card.typeId))} />}
  </>;
}
