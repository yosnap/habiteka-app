'use client';

import { Images, Video, WandSparkles } from 'lucide-react';
import ui from './workspace.module.css';

/** Despliega las entradas actuales del estudio, sin generar ni aceptar diseños al abrirse. */
export function WorkspaceVisualizePanel({
  canGenerate,
  onGenerate,
  onVideos,
}: {
  canGenerate: boolean;
  onGenerate: (intent: 'editable' | 'image') => void;
  onVideos?: () => void;
}) {
  return (
    <div className={ui.panelContent}>
      <p className={ui.hint}>
        Elige qué quieres preparar. Revisa las opciones y el coste en el estudio antes de generar.
      </p>
      <div className={ui.actionCards}>
        <button type="button" disabled={!canGenerate} onClick={() => onGenerate('editable')}>
          <WandSparkles size={20} aria-hidden="true" />
          <span>
            <strong>Diseñar el plano</strong>
            <small>Acabados y mobiliario sobre el plano actual</small>
          </span>
        </button>
        <button type="button" disabled={!canGenerate} onClick={() => onGenerate('image')}>
          <Images size={20} aria-hidden="true" />
          <span>
            <strong>Crear imágenes</strong>
            <small>Abre las opciones del estudio de imágenes</small>
          </span>
        </button>
        {onVideos && (
          <button type="button" onClick={onVideos}>
            <Video size={20} aria-hidden="true" />
            <span>
              <strong>Vídeos</strong>
              <small>Guarda los cambios y abre el estudio de vídeos</small>
            </span>
          </button>
        )}
      </div>
      {!canGenerate && (
        <p className={ui.hint}>
          La generación está disponible cuando el proyecto permite diseñar con IA.
        </p>
      )}
    </div>
  );
}
