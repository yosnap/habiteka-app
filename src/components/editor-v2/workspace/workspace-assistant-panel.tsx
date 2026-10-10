'use client';

import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { Camera, Sofa } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import ui from './workspace.module.css';

export function WorkspaceAssistantPanel({
  store,
  assistant,
  canGenerate,
  onGenerate,
}: {
  store: EditorStore;
  assistant?: ReactNode;
  canGenerate: boolean;
  onGenerate: (intent: 'editable' | 'image') => void;
}) {
  const document = useStore(store, (s) => s.document);
  const selection = useStore(store, (s) => s.selection);
  const level =
    document.levels?.find((item) => item.id === document.activeLevelId)?.name ?? 'Planta baja';
  return (
    <div className={ui.panelContent}>
      <div className={ui.contextCard}>
        <p className={ui.eyebrow}>Tu espacio de trabajo</p>
        <strong>{level}</strong>
        <p>
          {selection.length ? `${selection.length} elementos seleccionados` : 'Toda la planta'} ·
          revisión {document.revision}
        </p>
        <p className={ui.hint}>
          El asistente sigue el proyecto y su zona. La selección no se envía automáticamente a la
          IA.
        </p>
      </div>
      <div className={ui.actionCards}>
        <button type="button" disabled={!canGenerate} onClick={() => onGenerate('editable')}>
          <Sofa size={19} aria-hidden="true" />
          <span>
            <strong>Diseñar el plano</strong>
            <small>Revisar muebles y acabados antes de aplicar</small>
          </span>
        </button>
        <button type="button" disabled={!canGenerate} onClick={() => onGenerate('image')}>
          <Camera size={19} aria-hidden="true" />
          <span>
            <strong>Crear imágenes</strong>
            <small>Preparar vistas y opciones del diseño</small>
          </span>
        </button>
      </div>
      {assistant ?? (
        <p className={ui.hint}>
          La conversación está disponible al abrir un proyecto. Esta muestra no usa servicios de IA.
        </p>
      )}
    </div>
  );
}
