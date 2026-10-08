'use client';
import { useStore } from 'zustand';
import { ChevronDown, MousePointerClick } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { SELECTABLE_KINDS, applyKindSelection, idsByKind, type SelectableKind } from '@/canvas/editor-v2/select-by-kind';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import styles from './visibility-menu.module.css';
import { HeaderMenu } from './header-menu';
import type { MouseEvent } from 'react';

/** Selecciona de golpe todos los elementos de un tipo; el inspector aplica después cada cambio a toda la selección. */
export function SelectByKindMenu({ store, onSelect }: { store: EditorStore; onSelect?: () => void }) {
  const doc = useStore(store, (s) => s.document);
  const rooms = deriveRoomsSafe(doc);
  const kinds = SELECTABLE_KINDS.map((kind) => ({ ...kind, ids: idsByKind(doc, rooms, kind.id) }));
  const wallKinds = kinds.filter((kind) => kind.id === 'walls' || kind.id === 'interior-walls' || kind.id === 'exterior-walls');
  const otherKinds = kinds.filter((kind) => !wallKinds.includes(kind));
  const select = (kind: SelectableKind, ids: string[], event: MouseEvent<HTMLButtonElement>) => {
    onSelect?.();
    applyKindSelection(store, kind, ids);
    event.currentTarget.closest('details')?.removeAttribute('open');
    event.currentTarget.closest('[role="menu"]')?.closest('details')?.removeAttribute('open');
  };
  return <HeaderMenu icon={<MousePointerClick size={18} aria-hidden="true" />} label="Seleccionar" ariaLabel="Seleccionar todos los elementos de un tipo" role="menu">
    <details className={styles.submenu}>
      <summary aria-label="Tipos de paredes">
        <span>Paredes</span>
        <span className={styles.submenuMeta}><small>{wallKinds[0]?.ids.length ?? 0}</small><ChevronDown size={16} aria-hidden="true" /></span>
      </summary>
      <div role="group" aria-label="Tipos de paredes" className={styles.submenuItems}>
        {wallKinds.map((kind) => <button key={kind.id} type="button" role="menuitem" className={styles.item} disabled={!kind.ids.length}
          onClick={(event) => select(kind.id, kind.ids, event)}>
          <span>{kind.label}</span><small>{kind.ids.length}</small>
        </button>)}
      </div>
    </details>
    {otherKinds.map((kind) => <button key={kind.id} type="button" role="menuitem" className={styles.item} disabled={!kind.ids.length}
      onClick={(event) => select(kind.id, kind.ids, event)}>
      <span>{kind.label}</span><small>{kind.ids.length}</small>
    </button>)}
  </HeaderMenu>;
}
