'use client';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { WorkspaceSceneOptions } from './workspace-scene-options';
import type { EditorVisibility } from '../visibility-menu';

export function WorkspacePlanOptions({ store, visibility, onVisibility }: { store: EditorStore; visibility: EditorVisibility; onVisibility: (value: EditorVisibility) => void }) {
  const options = useStore(store, s => s.sceneOptions);
  return <div data-workspace-lighting>
    <WorkspaceSceneOptions options={{ ...options, dimensions: options.dimensions && visibility.dimensions !== 'none', walls: options.walls && visibility.walls }}
      onChange={next => {
        store.getState().setSceneOptions(next);
        if ((next.dimensions && visibility.dimensions === 'none') || (next.walls && !visibility.walls))
          onVisibility({ ...visibility, dimensions: next.dimensions && visibility.dimensions === 'none' ? 'all' : visibility.dimensions, walls: next.walls || visibility.walls });
      }} technical spatial={false}
      floors="solo" hasLevels={false} onFloors={() => {}} ceiling="hidden" onCeiling={() => {}}
      cutaway={false} onCutaway={() => {}} lighting="daylight" onLighting={() => {}}
      onTop={() => store.getState().requestView('fit')} onWalk={() => {}} disabled={false} />
  </div>;
}
