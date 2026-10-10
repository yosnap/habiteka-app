'use client';

import type { ComponentProps } from 'react';
import { useStore } from 'zustand';
import {
  Bot,
  BrickWall,
  CircleHelp,
  Images,
  Layers3,
  Paintbrush,
  Settings2,
  Sofa,
  Wrench,
} from 'lucide-react';
import type { Toolbar } from '../toolbar';
import { WorkspaceViewToolbar } from './workspace-view-toolbar';
import type { EditorViewMode } from '@/canvas/editor-v2/view-mode';
import type { EditorSidePanel } from '@/canvas/editor-v2/store';
import ui from './workspace.module.css';

type Props = ComponentProps<typeof Toolbar> & {
  mode: EditorViewMode;
  onViewChange: (mode: EditorViewMode) => void;
  onPanel: (panel: EditorSidePanel) => void;
};

/** Los tres modos comparten navegación; los comandos de construcción siguen siendo los mismos. */
export function EditorWorkspaceNavigation({ mode, onViewChange, onPanel, ...props }: Props) {
  const { store, constructionOpen, exteriorOpen, catalogOpen } = props;
  const sidePanel = useStore(store, (s) => s.sidePanel);
  const readOnly = useStore(store, (s) => s.readOnly);
  const tasks = [
    {
      label: 'Construir',
      Icon: BrickWall,
      active: constructionOpen || exteriorOpen,
      action: props.onConstruction,
      ref: props.constructionButtonRef,
    },
    {
      label: 'Amueblar',
      Icon: Sofa,
      active: catalogOpen,
      action: props.onCatalog,
      disabled: readOnly,
    },
    {
      label: 'Acabados',
      Icon: Paintbrush,
      active: sidePanel === 'materials' || sidePanel === 'ceiling',
      action: () => onPanel('materials'),
    },
    {
      label: 'Visualizar',
      Icon: Images,
      active: sidePanel === 'visualize',
      action: () => onPanel('visualize'),
    },
    {
      label: 'Asistente',
      Icon: Bot,
      active: sidePanel === 'assistant',
      action: () => onPanel('assistant'),
    },
    {
      label: 'Escena',
      Icon: Layers3,
      active: sidePanel === 'scene' || sidePanel === 'inspector',
      action: () => onPanel('scene'),
    },
    {
      label: 'Herramientas',
      Icon: Wrench,
      active: sidePanel === 'tools' || sidePanel === 'walkthrough' || sidePanel === 'context',
      action: () => onPanel('tools'),
    },
  ];
  return (
    <>
      <WorkspaceViewToolbar
        store={store}
        mode={mode}
        onViewChange={onViewChange}
        onSelect={props.onSelectTool}
      />
      <nav
        className={`${ui.rail} ${process.env.NODE_ENV === 'development' ? ui.development : ''}`}
        aria-label="Tareas del espacio de trabajo"
        data-workspace-rail
      >
        <div className={ui.railTasks}>
          {tasks.map(({ label, Icon, active, action, disabled, ref }) => (
            <button
              key={label}
              type="button"
              ref={ref}
              data-side-panel-toggle
              aria-pressed={active}
              aria-expanded={active}
              disabled={disabled}
              onClick={action}
              title={label}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className={ui.railEnd}>
          <a
            href={`${process.env.NODE_ENV === 'development' ? 'http://docs.localhost:3040' : 'https://docs.habiteka.app'}/editor/herramientas/`}
            target="_blank"
            rel="noreferrer"
            aria-label="Ayuda del editor (se abre en otra pestaña)"
          >
            <CircleHelp size={20} aria-hidden="true" />
            <span>Ayuda</span>
          </a>
          <button
            type="button"
            data-side-panel-toggle
            aria-pressed={sidePanel === 'settings'}
            aria-expanded={sidePanel === 'settings'}
            onClick={() => onPanel('settings')}
          >
            <Settings2 size={20} aria-hidden="true" />
            <span>Ajustes</span>
          </button>
        </div>
      </nav>
    </>
  );
}
