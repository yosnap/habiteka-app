'use client';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { serializeFurnitureDesignContext } from '@/lib/editor-document/furniture-context';
import styles from './furniture-context-panel.module.css';

/** Contenido del panel «Contexto IA»; la ranura lateral pone cabecera y cierre. */
export function FurnitureContextPanel({ store }: { store: EditorStore }) {
  const doc = useStore(store, (state) => state.document);
  const [message, setMessage] = useState('');
  const context = useMemo(() => serializeFurnitureDesignContext(doc), [doc]);
  return <section className={styles.panel} aria-label="Contexto de mobiliario para IA">
    <p>Datos actuales de todas las plantas · revisión {doc.revision}. Copiar no genera imágenes ni consume créditos.</p>
    <label>Contexto estructurado<textarea readOnly value={context} spellCheck={false} /></label>
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(context); setMessage('Contexto copiado.'); }
      catch { setMessage('No se pudo copiar. Selecciona el texto y cópialo manualmente.'); }
    }}>Copiar contexto</button>
    <p role="status">{message}</p>
  </section>;
}
