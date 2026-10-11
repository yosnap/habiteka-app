'use client';

import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { type ElementPackage, type PackageCategory } from '@/lib/editor-document/element-packages';
import { deleteElementPackage, listElementPackages } from '@/server/actions/element-packages';
import { PackagePreview } from './package-preview';
import styles from './element-packages.module.css';

const FILTERS = { all: 'Todos', furniture: 'Muebles', construction: 'Construcción', mixed: 'Mixtos' } as const;

export function ElementPackagesPanel({ store, onPlace }: { store: EditorStore; onPlace: () => void }) {
  const readOnly = useStore(store, s => s.readOnly);
  const [packages, setPackages] = useState<ElementPackage[]>([]), [filter, setFilter] = useState<PackageCategory | 'all'>('all');
  const [query, setQuery] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    listElementPackages().then(result => { if (alive) setPackages(result); })
      .catch(() => { if (alive) setError('No se pudo cargar tu biblioteca. Comprueba la conexión y vuelve a intentarlo.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);
  const matches = packages.filter(pack => (filter === 'all' || pack.category === filter) && pack.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
  return <div className={styles.panel}>
    <p>Tu biblioteca personal, disponible en todos tus proyectos y dispositivos. Cada inserción crea una copia independiente.</p>
    <label>Buscar paquetes<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className={styles.buttons} role="group" aria-label="Tipos de paquete">{Object.entries(FILTERS).map(([id, label]) =>
      <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id as typeof filter)}>{label}</button>)}</div>
    {loading && <p role="status">Cargando paquetes…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => { setError(''); setLoading(true); setReload(value => value + 1); }}>Volver a cargar</button></div>}
    {!loading && !error && !matches.length && <p>{packages.length ? 'No hay paquetes con estos filtros.' : 'Selecciona elementos y pulsa «Guardar como paquete» en Escena o Propiedades.'}</p>}
    {matches.map(pack => <article key={pack.id} className={styles.card}>
      <PackagePreview document={pack.document} name={pack.name} /><strong>{pack.name}</strong><small>{FILTERS[pack.category]}</small>
      <button type="button" disabled={readOnly || busy} onClick={() => {
        try {
          const state = store.getState();
          state.beginPlacePackage(pack); onPlace();
        } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo insertar el paquete.'); }
      }}>Colocar en el plano</button>
      {deleting !== pack.id ? <button type="button" disabled={readOnly || busy} onClick={() => setDeleting(pack.id)}>Eliminar de la biblioteca</button>
        : <div><p>¿Eliminar «{pack.name}» de la biblioteca? Las copias insertadas se conservan.</p><div className={styles.buttons}>
          <button type="button" disabled={busy || readOnly} onClick={async () => {
            setBusy(true);
            try { await deleteElementPackage(pack.id); setPackages(current => current.filter(item => item.id !== pack.id)); setDeleting(null); }
            catch { setError('No se pudo eliminar el paquete. Vuelve a intentarlo.'); }
            finally { setBusy(false); }
          }}>{busy ? 'Eliminando…' : 'Eliminar paquete'}</button><button type="button" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button>
        </div></div>}
    </article>)}
  </div>;
}
