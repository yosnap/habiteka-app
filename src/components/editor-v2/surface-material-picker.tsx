'use client';
import { useState } from 'react';
import { ModernSelect } from '@/components/ui/modern-select';
import { SURFACE_MATERIALS, SURFACE_CATEGORIES, surfaceMaterial } from '@/lib/editor-document/surface-materials';

export function SurfaceMaterialPicker({ value, label, onChange }: {
  value?: string; label: string; onChange: (id: string | undefined) => void;
}) {
  const [category, setCategory] = useState(''), [query, setQuery] = useState('');
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const entries = SURFACE_MATERIALS.filter((m) => (!category || m.category === category)
    && normalize(`${m.label} ${m.category}`).includes(normalize(query)));
  const active = surfaceMaterial(value);
  return <details style={{ marginBlock: 12 }}><summary>{label}: {active?.label ?? 'Sin textura'}</summary>
    <label style={{ display: 'block', marginBlock: 8 }}>Buscar material
      <input aria-label={`Buscar material ${label}`} value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: '100%' }} />
    </label>
    <ModernSelect aria-label={`Categoría ${label}`} value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%' }}>
      <option value="">Todas las categorías</option>{SURFACE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
    </ModernSelect>
    <button type="button" onClick={() => onChange(undefined)} style={{ marginBlock: 8 }}>Quitar textura</button>
    <p style={{ fontSize: 12 }}>{entries.length} materiales · CC0 y texturas propias</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto', overscrollBehavior: 'contain' }}>
      {entries.map((m) => <button key={m.id} type="button" aria-label={`Aplicar ${m.label} en ${label}`}
        aria-pressed={m.id === value} onClick={() => onChange(m.id)} style={{ padding: 4, border: m.id === value ? '2px solid #087f75' : '1px solid #ddd', fontSize: 11 }}>
        {/* Local thumbnail: no third-party request while editing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.preview} alt="" loading="lazy" width={100} height={80} style={{ width: '100%', objectFit: 'cover' }} />{m.label}
      </button>)}
    </div>
    {active && <a href={active.source} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Fuente y autores: {active.authors.join(', ')}</a>}
  </details>;
}
