'use client';
import { isBoundaryKind } from '@/lib/editor-document/linear-boundary';
import { useState } from 'react';
import { OUTDOOR_CATALOG } from '@/lib/editor-document/outdoor-catalog';
import { CONSTRUCTION_GROUPS, constructionGroup } from '@/lib/editor-document/element-classification';
import type { FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { OutdoorThumbnail } from './outdoor-thumbnail';
import styles from './editor.module.css';
import { ModernSelect } from '@/components/ui/modern-select';
export function OutdoorConstructionCatalog({ readOnly, onAdd }: { readOnly: boolean; onAdd?: (item: FurnitureCatalogEntry) => void }) {
  const [group, setGroup] = useState(''), [query, setQuery] = useState('');
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const items = OUTDOOR_CATALOG.filter((item) => constructionGroup(item) && (!group || constructionGroup(item) === group) && normalize(item.label).includes(normalize(query)));
  return <div className={styles.constructionCatalog}><h3>Exterior y jardín</h3>
    <label>Buscar elemento<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Árbol, piscina, valla…" /></label>
    <label>Categoría<ModernSelect value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Todas</option>{CONSTRUCTION_GROUPS.map((g) => <option key={g}>{g}</option>)}</ModernSelect></label>
    <div className={styles.constructionCards}>{items.map((item) => <button key={item.id} type="button" disabled={readOnly || !onAdd} onClick={() => onAdd?.(item)} aria-label={`${isBoundaryKind(item.kind) ? 'Dibujar' : 'Añadir'} ${item.label}`}>
      <OutdoorThumbnail item={item} /><strong>{item.label}</strong><small>{isBoundaryKind(item.kind) ? 'Clics para dibujar tramos' : constructionGroup(item)}</small>
    </button>)}</div>{!items.length && <p>No hay elementos con estos filtros.</p>}
  </div>;
}
