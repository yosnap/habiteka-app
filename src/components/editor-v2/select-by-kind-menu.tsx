'use client';
import { useStore } from 'zustand';
import { MousePointerClick } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { SELECTABLE_KINDS, idsByKind } from '@/canvas/editor-v2/select-by-kind';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import styles from './visibility-menu.module.css';
import { HeaderMenu } from './header-menu';

/** Selecciona de golpe todos los elementos de un tipo; el inspector aplica después cada cambio a toda la selección. */
export function SelectByKindMenu({ store }: { store: EditorStore }) {
  const doc = useStore(store, (s) => s.document);
  const rooms = deriveRoomsSafe(doc);
  const kinds = SELECTABLE_KINDS.map((kind) => ({ ...kind, ids: idsByKind(doc, rooms, kind.id) }));
  return <HeaderMenu icon={<MousePointerClick size={18} aria-hidden="true" />} label="Seleccionar" ariaLabel="Seleccionar todos los elementos de un tipo" role="menu">
    {kinds.map((kind) => <button key={kind.id} type="button" role="menuitem" className={styles.item} disabled={!kind.ids.length}
      onClick={(event) => { store.getState().setTool('select'); store.getState().select(kind.ids); event.currentTarget.closest('details')?.removeAttribute('open'); }}>
      <span>{kind.label}</span><small>{kind.ids.length}</small>
    </button>)}
  </HeaderMenu>;
}
