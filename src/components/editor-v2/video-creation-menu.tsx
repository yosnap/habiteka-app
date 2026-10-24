'use client';

import { Footprints, Hammer, Megaphone, X } from 'lucide-react';
import type { VideoGoal } from '@/lib/editor-document/video-studio';
import ui from './video-creation-menu.module.css';

type Goal = Exclude<VideoGoal, 'combined'>;
const OPTIONS = [
  { id: 'construction', label: 'Construcción', description: 'Preparar el vídeo de construcción del diseño.', Icon: Hammer },
  { id: 'advertising', label: 'Publicidad', description: 'Crear un anuncio con diseños o vídeos aceptados.', Icon: Megaphone },
  { id: 'visit', label: 'Primera persona', description: 'Preparar el paseo por el diseño aceptado.', Icon: Footprints },
] as const;

export function VideoCreationMenu({ id, goal, busy, onChoose, onClose }: {
  id: string; goal: Goal; busy: boolean; onChoose: (goal: Goal) => void; onClose: () => void;
}) {
  return <aside id={id} aria-label="Opciones de Crear vídeo" className={ui.menu}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <header className={ui.header}><h2>Crear vídeo</h2>
      <button type="button" aria-label="Cerrar opciones de Crear vídeo" onClick={onClose}><X size={20} aria-hidden="true" /></button>
    </header>
    <div className={ui.options}>
      <p>Elige qué quieres crear a partir de tus diseños IA aceptados.</p>
      {OPTIONS.map(({ id: value, label, description, Icon }) => <button key={value} type="button"
        aria-pressed={goal === value} disabled={busy} onClick={() => onChoose(value)}>
        <Icon size={21} aria-hidden="true" /><span><strong>{label}</strong><small>{description}</small></span>
      </button>)}
    </div>
  </aside>;
}
