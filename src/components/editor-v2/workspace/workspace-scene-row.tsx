'use client';

import { useState } from 'react';
import { useStore } from 'zustand';
import { ChevronRight, Eye, EyeOff, Pencil, Check, X } from 'lucide-react';
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
  const blocked = useStore(store, (s) => Boolean(s.pendingSpatial) || s.tool !== 'select');
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(node.label);
  const visible = !hidden.includes(node.id);
  const locate = (properties = false) => {
    if (blocked) return;
    const state = store.getState();
    state.setElementsVisible([node.id], true);
    // Las zonas de diseño se editan aquí; no son entidades del inspector geométrico.
    state.select(node.group === 'Zonas de diseño' ? [] : [node.id]);
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
        aria-pressed={selection.includes(node.id)}
        onClick={() => locate()}
        onDoubleClick={() => { if (node.group !== 'Zonas de diseño') locate(true); }}
        title={`Localizar ${node.label}`}
      >
        {node.label}
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
        disabled={readOnly || blocked || !node.renamable}
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
      {node.children.length ? (
        <details className={ui.wallBranch}>
          <summary>
            <ChevronRight size={14} className={ui.branchChevron} aria-hidden="true" />
            {node.label}
            <span>
              {node.children.length}{' '}
              {node.group === 'Techos' ? 'luces' : node.children.length === 1 ? 'hueco' : 'huecos'}
            </span>
          </summary>
          {row}
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
      ) : (
        row
      )}
      {(node.group === 'Estancias' || node.group === 'Zonas de diseño') &&
        <SceneSpaceClassification store={store} id={node.id} name={node.label} rooms={rooms} disabled={readOnly || blocked} />}
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
