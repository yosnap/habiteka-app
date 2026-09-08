'use client';
import { useState } from 'react';
import { CATALOG, type CatalogEntry } from '@/canvas/catalog';
import styles from './editor.module.css';

export function CatalogPanel({ onAdd, onClose }: { onAdd: (item: CatalogEntry) => void; onClose: () => void }) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('mobiliario');
  const categories = CATALOG.filter((c) => c.id !== 'estructura');
  const items = categories.filter((c) => !category || c.id === category).flatMap((c) => c.items)
    .filter((item) => item.label.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
  return <aside className={styles.catalog} aria-label="Catálogo de muebles">
    <div className={styles.panelHeading}><h2>Amueblar</h2><button onClick={onClose} aria-label="Cerrar catálogo">Cerrar</button></div>
    <label className={styles.field}>Buscar mueble<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sofá, mesa, lavabo…" /></label>
    <label className={styles.field}>Categoría<select value={category} onChange={(e) => setCategory(e.target.value)}>
      <option value="">Todas</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
    </select></label>
    <div className={styles.catalogItems}>{items.map((item) => <button key={item.kind} onClick={() => onAdd(item)}>
      <span className={styles.catalogSymbol} aria-hidden="true">{item.realWidthM.toFixed(1)} × {item.realDepthM.toFixed(1)}</span>
      <strong>{item.label}</strong><small>m · Añadir al plano</small>
    </button>)}</div>
    {!items.length && <p>No hay muebles con ese nombre en esta categoría.</p>}
  </aside>;
}
