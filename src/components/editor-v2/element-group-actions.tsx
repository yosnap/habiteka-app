'use client';

import { useState } from 'react';
import { useStore } from 'zustand';
import { Group, Ungroup, PackagePlus, Library, Lock } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { elementIds, groupElements, ungroupElements } from '@/lib/editor-document/element-groups';
import { lockedElementIds } from '@/lib/editor-document/element-locks';
import { extractElementPackage } from '@/lib/editor-document/element-packages';
import { saveElementPackage } from '@/server/actions/element-packages';
import styles from './element-packages.module.css';

export function ElementGroupActions({ store }: { store: EditorStore }) {
  const doc = useStore(store, s => s.document), selection = useStore(store, s => s.selection);
  const readOnly = useStore(store, s => s.readOnly), busyTool = useStore(store, s => s.tool !== 'select');
  const [mode, setMode] = useState<'group' | 'save' | null>(null), [name, setName] = useState('');
  const [saving, setSaving] = useState(false), [status, setStatus] = useState('');
  const locked = lockedElementIds(doc), blocked = selection.some(id => locked.has(id));
  const grouped = doc.elementGroups?.find(group => group.elementIds.some(id => selection.includes(id)));
  const available = elementIds(doc), canGroup = selection.length > 1 && selection.every(id => available.has(id));
  const disabled = readOnly || busyTool || saving;
  const begin = (action: 'group' | 'save') => { setMode(action); setName(grouped?.name ?? ''); setStatus(''); };
  return <section className={styles.actions} aria-label="Grupos y paquetes">
    <div className={styles.buttons}>
      <button type="button" onClick={() => store.getState().openSidePanel('packages')}><Library size={16} />Mis paquetes</button>
      {selection.length > 0 && <>
        <button type="button" disabled={disabled || blocked || !canGroup} onClick={() => begin('group')}><Group size={16} />Agrupar</button>
        {grouped && <button type="button" disabled={disabled || blocked} onClick={() => {
          try { store.getState().apply(ungroupElements(doc, selection)); setStatus('Grupo deshecho.'); }
          catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo desagrupar.'); }
        }}><Ungroup size={16} />Desagrupar</button>}
        <button type="button" disabled={disabled} onClick={() => begin('save')}><PackagePlus size={16} />Guardar como paquete</button>
      </>}
    </div>
    {blocked && <p><Lock size={14} />Selección bloqueada. Desbloquéala desde Escena para editarla.</p>}
    {grouped && <p>Grupo: {grouped.name}. Doble clic en su pieza en Escena para editar solo esa pieza.</p>}
    {mode && <form onSubmit={async event => {
      event.preventDefault();
      if (disabled) return;
      try {
        if (mode === 'group') { store.getState().apply(groupElements(doc, selection, name)); setStatus('Elementos agrupados.'); }
        else {
          const snapshot = extractElementPackage(doc, selection);
          setSaving(true);
          await saveElementPackage(name, snapshot);
          setStatus('Paquete guardado en tu cuenta, disponible en todos tus proyectos.');
        }
        setMode(null);
      } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo guardar. Inténtalo de nuevo.'); }
      finally { setSaving(false); }
    }}>
      <label>Nombre del {mode === 'group' ? 'grupo' : 'paquete'}<input autoFocus required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={saving} /></label>
      {mode === 'save' && <p>Incluye los soportes necesarios de las piezas seleccionadas. Se guarda una copia independiente.</p>}
      <div className={styles.buttons}><button type="submit" disabled={disabled || !name.trim()}>{saving ? 'Guardando…' : mode === 'group' ? 'Crear grupo' : 'Guardar paquete'}</button>
        <button type="button" disabled={saving} onClick={() => setMode(null)}>Cancelar</button></div>
    </form>}
    {status && <p role="status">{status}</p>}
  </section>;
}
