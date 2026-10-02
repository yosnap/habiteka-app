'use client';
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { SlidersHorizontal, X } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { planElementIndex } from '@/lib/editor-document/plan-element-index';
import { selectionPropertyScope } from '@/canvas/editor-v2/selection-properties';
import styles from './selection-properties.module.css';

export function SelectionPropertiesBar({ store, onProperties }: { store: EditorStore; onProperties: () => void }) {
  const doc = useStore(store, (state) => state.document), selection = useStore(store, (state) => state.selection);
  const panel = useStore(store, (state) => state.sidePanel);
  const index = useMemo(() => planElementIndex(doc, deriveRoomsSafe(doc)), [doc]);
  const { multiple, mixed } = selectionPropertyScope(doc, selection);
  if (!selection.length) return null;
  const label = multiple ? `${selection.length} elementos seleccionados` : index.find((entry) => entry.id === selection[0])?.label ?? 'Elemento seleccionado';
  return <section className={styles.summaryBar} aria-label="Selección actual">
    <div className={styles.summary}>
      <strong>{label}</strong>
      <span>{mixed ? 'Elige un elemento en Propiedades para editarlo.' : multiple ? 'Revisa las propiedades comunes.' : 'Medidas, acabados y acciones en Propiedades.'}</span>
    </div>
    <button type="button" className={styles.summaryAction} data-side-panel-toggle aria-pressed={panel === 'inspector'} onClick={onProperties}>
      <SlidersHorizontal size={18} aria-hidden="true" />Propiedades
    </button>
    <button type="button" title="Quitar selección" aria-label="Quitar selección" onClick={() => store.getState().select([])}>
      <X size={18} aria-hidden="true" />
    </button>
  </section>;
}
