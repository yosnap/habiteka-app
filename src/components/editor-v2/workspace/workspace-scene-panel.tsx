'use client';

import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { BrickWall, Camera, ChevronRight, LayoutGrid, Search, Sofa } from 'lucide-react';
import { EDITOR_SHORTCUTS } from '@/canvas/editor-v2/editor-shortcuts';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { filterSceneTree, sceneTree, SCENE_TABS, type SceneTab } from './workspace-scene-tree';
import { WorkspaceSceneRow } from './workspace-scene-row';
import ui from './workspace.module.css';

const TAB_ICONS = { structure: BrickWall, objects: Sofa, rooms: LayoutGrid };

/** Navega el índice real de elementos; no mantiene una copia de la geometría. */
export function WorkspaceScenePanel({
  store,
  onProperties,
  onCapture,
  tab,
  onTabChange,
}: {
  store: EditorStore;
  onProperties: () => void;
  onCapture: () => void;
  tab: SceneTab;
  onTabChange: (tab: SceneTab) => void;
}) {
  const document = useStore(store, (s) => s.document);
  const hidden = useStore(store, (s) => s.hiddenElementIds);
  const [query, setQuery] = useState('');
  const [limits, setLimits] = useState<Record<string, number>>({});
  const rooms = useMemo(() => {
    let rooms: ReturnType<typeof deriveRooms> = [];
    try {
      rooms = deriveRooms(document);
    } catch {
      /* Un plano incompleto sigue siendo navegable. */
    }
    return rooms;
  }, [document]);
  const index = useMemo(() => sceneTree(document, rooms), [document, rooms]);
  const matches = filterSceneTree(index, tab, query);
  const groups = [...new Set(matches.map((entry) => entry.group))];
  const level =
    document.levels?.find((item) => item.id === document.activeLevelId)?.name ?? 'Planta baja';
  return (
    <div className={ui.panelContent}>
      <button type="button" onClick={onCapture} title="Descargar una referencia del lienzo actual">
        <Camera size={17} aria-hidden="true" /> Capturar vista de trabajo
      </button>
      <p className={ui.eyebrow}>{level}</p>
      <div className={ui.sceneTabs} role="group" aria-label="Capas de la escena">
        {SCENE_TABS.map((item) => {
          const Icon = TAB_ICONS[item.id];
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => onTabChange(item.id)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
              <kbd>{EDITOR_SHORTCUTS[item.shortcut].label}</kbd>
            </button>
          );
        })}
      </div>
      <label className={ui.search}>
        <Search size={17} aria-hidden="true" />
        <input
          aria-label="Buscar en la escena"
          placeholder="Buscar estancia, pared, objeto…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimits({});
          }}
        />
      </label>
      <p className={ui.hint}>
        Clic: localizar. Doble clic: propiedades.
      </p>
      {hidden.length > 0 && (
        <button type="button" onClick={() => store.getState().setElementsVisible(hidden, true)}>
          Mostrar elementos ocultos ({hidden.length})
        </button>
      )}
      {!matches.length && <p role="status">No hay elementos que coincidan con tu búsqueda.</p>}
      {groups.map((group) => (
        <details key={group} className={ui.group} open>
          <summary>
            <ChevronRight size={15} className={ui.branchChevron} aria-hidden="true" />
            {group}
            <span>{matches.filter((entry) => entry.group === group).length}</span>
          </summary>
          {matches
            .filter((entry) => entry.group === group)
            .slice(0, limits[`${tab}:${group}`] ?? 12)
            .map((node) => (
              <WorkspaceSceneRow
                key={node.id}
                store={store}
                node={node}
                rooms={rooms}
                onProperties={onProperties}
              />
            ))}
          {matches.filter((entry) => entry.group === group).length >
            (limits[`${tab}:${group}`] ?? 12) && (
            <button
              type="button"
              onClick={() => {
                const key = `${tab}:${group}`;
                setLimits((previous) => ({ ...previous, [key]: (previous[key] ?? 12) + 24 }));
              }}
            >
              Mostrar{' '}
              {Math.min(
                24,
                matches.filter((entry) => entry.group === group).length -
                  (limits[`${tab}:${group}`] ?? 12),
              )}{' '}
              más
            </button>
          )}
        </details>
      ))}
    </div>
  );
}
