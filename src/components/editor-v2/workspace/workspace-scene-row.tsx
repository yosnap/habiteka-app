'use client';

import { useState } from 'react';
import { useStore } from 'zustand';
import { ChevronRight, Eye, EyeOff, Pencil, Check, X, Lock, LockOpen } from 'lucide-react';
import { isElementLocked } from '@/lib/editor-document/element-locks';
import { clickSelect } from '@/canvas/editor-v2/selection-click';
import { expandElementGroups } from '@/lib/editor-document/element-groups';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { DerivedRoom } from '@/lib/editor-document/rooms';
import { renameSceneElement, type SceneTreeNode } from './workspace-scene-tree';
import ui from './workspace.module.css';
import { SceneSpaceClassification } from './scene-space-classification';

export function WorkspaceSceneRow({
  store,
  node,
  rooms,
  onProperties,
}: {
  store: EditorStore;
  node: SceneTreeNode;
  rooms: DerivedRoom[];
  onProperties: () => void;
}) {
  const selection = useStore(store, (s) => s.selection);
  const hidden = useStore(store, (s) => s.hiddenElementIds);
  const readOnly = useStore(store, (s) => s.readOnly);
  const locked = useStore(store, s => isElementLocked(s.document, node.id));
  const selected = useStore(store, s => expandElementGroups(s.document, [node.id]).some(id => selection.includes(id)));
  const blocked = useStore(store, (s) => Boolean(s.pendingSpatial) || s.tool !== 'select');
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(node.label);
  const visible = !hidden.includes(node.id);
  const locate = (properties = false, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
    if (blocked) return;
    const state = store.getState();
    state.setElementsVisible([node.id], true);
    // Las zonas de diseño se editan aquí; no son entidades del inspector geométrico.
    if (node.group === 'Zonas de diseño') state.select([]);
    else if (properties) state.select([node.id], node.group !== 'Grupos');
    else clickSelect(store, node.id, event);
    state.focusOn(node.point);
    if (properties) {
      if (node.propertiesPanel === 'ceiling') store.getState().openSidePanel('ceiling');
      else onProperties();
    } else store.getState().openSidePanel('scene');
  };
  const row = (
    <div className={ui.treeRow} data-scene-element={node.id}>
      <button
        type="button"
        className={ui.treeName}
        disabled={blocked}
        aria-pressed={selected}
        onClick={event => locate(false, event)}
        onDoubleClick={() => { if (node.group !== 'Zonas de diseño') locate(true); }}
        title={`Localizar ${node.label}`}
      >
        {node.label}
      </button>
      <button type="button" disabled={readOnly || blocked} aria-pressed={locked}
        aria-label={`${locked ? 'Desbloquear' : 'Bloquear'} ${node.label}`}
        title={locked ? 'Desbloquear elemento y su grupo' : 'Bloquear elemento y su grupo'}
        onClick={() => store.getState().setElementsLocked([node.id], !locked)}>
        {locked ? <Lock size={16} /> : <LockOpen size={16} />}
      </button>
      <button
        type="button"
        disabled={blocked || !(node.hideable ?? node.renamable)}
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${node.label}`}
        title={visible ? 'Ocultar en el editor' : 'Mostrar en el editor'}
        onClick={() => {
          store
            .getState()
            .setElementsVisible([node.id, ...node.children.map((child) => child.id)], !visible);
        }}
      >
        {visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <button
        type="button"
        disabled={readOnly || locked || blocked || !node.renamable}
        aria-label={`Renombrar ${node.label}`}
        title="Renombrar"
        onClick={() => {
          setName(node.label);
          setEditing(true);
        }}
      >
        <Pencil size={15} />
      </button>
    </div>
  );
  return (
    <div className={ui.treeNode}>
      {row}
      {node.children.length ? (
        <details className={ui.wallBranch}>
          <summary>
            <ChevronRight size={14} className={ui.branchChevron} aria-hidden="true" />
            Ver contenido
            <span>
              {node.children.length}{' '}
              {node.group === 'Grupos' ? 'elementos' : node.group === 'Techos' ? 'luces' : node.children.length === 1 ? 'hueco' : 'huecos'}
            </span>
          </summary>
          <div className={ui.treeChildren}>
            {node.children.map((child) => (
              <WorkspaceSceneRow
                key={child.id}
                store={store}
                node={child}
                rooms={rooms}
                onProperties={onProperties}
              />
            ))}
          </div>
        </details>
      ) : null}
      {(node.group === 'Estancias' || node.group === 'Zonas de diseño') &&
        <SceneSpaceClassification store={store} id={node.id} name={node.label} rooms={rooms} disabled={readOnly || locked || blocked} />}
      {editing && (
        <form
          className={ui.renameForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (blocked || readOnly) return;
            try {
              store
                .getState()
                .apply(renameSceneElement(store.getState().document, node.id, name, rooms));
              setEditing(false);
            } catch (error) {
              store
                .getState()
                .setError(error instanceof Error ? error.message : 'No se pudo cambiar el nombre.');
            }
          }}
        >
          <input
            autoFocus
            aria-label={`Nuevo nombre de ${node.label}`}
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setEditing(false);
              }
            }}
          />
          <button type="submit" disabled={readOnly || blocked} aria-label="Guardar nombre">
            <Check size={16} />
          </button>
          <button
            type="button"
            aria-label="Cancelar cambio de nombre"
            onClick={() => setEditing(false)}
          >
            <X size={16} />
          </button>
        </form>
      )}
    </div>
  );
}
