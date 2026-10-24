'use client';
import { Hand, MousePointer2 } from 'lucide-react';
import styles from './workspace-scene-interaction.module.css';

export function WorkspaceSceneInteraction({ editing, disabled, onChange }: {
  editing: boolean; disabled: boolean; onChange: (editing: boolean) => void;
}) {
  return <div className={styles.control} role="group" aria-label="Interacción en 3D">
    <button type="button" aria-pressed={!editing} onClick={() => onChange(false)}><Hand size={18} />Mover vista</button>
    <button type="button" aria-pressed={editing} disabled={disabled} onClick={() => onChange(true)}><MousePointer2 size={18} />Editar</button>
  </div>;
}
