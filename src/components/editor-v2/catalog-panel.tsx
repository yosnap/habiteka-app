'use client';
import { constructionGroup } from '@/lib/editor-document/element-classification';
import { useMemo, useState } from 'react';
import { ArrowLeft, Search, SlidersHorizontal } from 'lucide-react';
import { CatalogNavigationImage } from './catalog-navigation-image';
import { CATALOG_CATEGORIES, matchesCatalogCategory } from './catalog-navigation';
import { ModernSelect } from '@/components/ui/modern-select';
import { FURNITURE_CATALOG, FURNITURE_ROOMS, searchFurnitureCatalog,
  type FurnitureCatalogEntry, type FurnitureRoom } from '@/lib/editor-document/furniture-catalog';
import styles from './catalog-panel.module.css';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { CatalogPhoto, catalogEntryPhotoSource } from './catalog-photo';

const stylesAvailable = [...new Set(FURNITURE_CATALOG.map((item) => item.style))].sort();
const measure = new Intl.NumberFormat('es', { maximumFractionDigits: 3 });
/** Foto real del modelo 3D de la pieza; sin dibujo de respaldo (marcador neutro si no se puede generar). */
function Thumbnail({ item }: { item: FurnitureCatalogEntry }) {
  const source = useMemo(() => catalogEntryPhotoSource(item), [item]);
  return <CatalogPhoto source={source} className={styles.thumbnail} />;
}
function CatalogCard({ variants, onAdd, readOnly }: { variants: FurnitureCatalogEntry[]; onAdd: (item: FurnitureCatalogEntry) => void; readOnly: boolean }) {
  const [selectedId, setSelectedId] = useState(variants[0]!.id);
  const item = variants.find((entry) => entry.id === selectedId) ?? variants[0]!;
  const asset = furnitureAsset({ catalogId: item.id });
  return <article className={styles.card} data-room={item.room}>
    <Thumbnail item={item} />
    <h3>{item.label}</h3>
    <p className={styles.dimensions}>{[item.widthMm, item.depthMm, item.heightMm].map((n) => measure.format(n / 1000)).join(' × ')} m</p>
    <p className={styles.material}>{item.material} · {item.style}</p>
    {asset && <details className={styles.material}><summary>Detalles y créditos</summary>
      <p>{asset.author} · {asset.license}</p><p>{asset.source}</p>
      <p>Adaptado en tamaño/orientación; tinte opcional. Símbolo 2D aproximado y colisión por caja conservadora.</p>
      {asset.attributionRequired && <p><a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa" target="_blank" rel="noreferrer">Modelo original</a>{' · '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">Licencia CC BY 4.0</a></p>}
    </details>}
    {variants.length > 1 ? <label className={styles.variant}>Variante
      <ModernSelect value={item.id} onChange={(event) => setSelectedId(event.target.value)} aria-label={`Variante de ${item.label}`}>
        {variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.variantLabel}</option>)}
      </ModernSelect>
    </label> : null}
    <button type="button" className={styles.add} disabled={readOnly} onClick={() => onAdd(item)} aria-label={`Añadir ${item.label}${item.variantLabel !== 'Original' ? ` · ${item.variantLabel}` : ''}`}>Añadir al plano</button>
  </article>;
}
export function CatalogPanel({ onAdd, onClose, readOnly = false }: {
  onAdd: (item: FurnitureCatalogEntry) => void; onClose: () => void; readOnly?: boolean;
}) {
  const [query, setQuery] = useState(''), [room, setRoom] = useState(''), [style, setStyle] = useState('');
  const [category, setCategory] = useState('');
  const [browse, setBrowse] = useState<'rooms' | 'categories'>('rooms');
  const [all, setAll] = useState(false);
  const showHome = !query.trim() && !room && !category && !style && !all;
  const groups = useMemo(() => {
    const result = new Map<string, FurnitureCatalogEntry[]>();
    for (const item of searchFurnitureCatalog(query, room, style).filter((item) => !constructionGroup(item) && matchesCatalogCategory(item, category))) result.set(item.productId, [...(result.get(item.productId) ?? []), item]);
    return [...result.values()];
  }, [query, room, style, category]);
  const reset = () => { setQuery(''); setRoom(''); setStyle(''); setCategory(''); setAll(false); };
  return <aside className={styles.catalog} aria-label="Catálogo de muebles" onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
  }}>
    <div className={styles.filters}>
      {!showHome && <button type="button" className={styles.back} onClick={reset}><ArrowLeft size={16} />Todas las habitaciones y categorías</button>}
      <label className={styles.search}><span><Search size={16} />Buscar en el catálogo</span><input type="search" name="furniture-search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sofá, mesa, lavabo…" /></label>
      {!showHome && <><h3 className={styles.selectionTitle}>{room ? FURNITURE_ROOMS[room as FurnitureRoom] : CATALOG_CATEGORIES.find(item => item.id === category)?.label ?? 'Todos los muebles'}</h3><details><summary className={styles.filterSummary}><SlidersHorizontal size={14} />Filtrar por estancia y estilo</summary><div className={styles.filterRow}>
        <label>Estancia<ModernSelect value={room} onChange={(event) => setRoom(event.target.value)}>
          <option value="">Todas las estancias</option>{Object.entries(FURNITURE_ROOMS).map(([id, label]) => <option key={id} value={id}>{id === 'exterior' ? 'Mobiliario exterior' : label}</option>)}
        </ModernSelect></label>
        <label>Estilo<ModernSelect value={style} onChange={(event) => setStyle(event.target.value)}>
          <option value="">Todos los estilos</option>{stylesAvailable.map((label) => <option key={label}>{label}</option>)}
        </ModernSelect></label>
      </div></details></>}
      {!showHome && <p className={styles.count} aria-live="polite">{groups.length} elementos · ancho × fondo × alto</p>}
      {readOnly ? <p>Solo lectura: puedes explorar, pero no añadir muebles.</p> : null}
    </div>
    {showHome ? <>
      <div className={styles.browseTabs} role="group" aria-label="Explorar catálogo">
        <button type="button" aria-pressed={browse === 'rooms'} onClick={() => setBrowse('rooms')}>Habitaciones</button>
        <button type="button" aria-pressed={browse === 'categories'} onClick={() => setBrowse('categories')}>Categorías</button>
      </div>
      <div className={styles.roomGrid}>
        {browse === 'rooms' ? Object.entries(FURNITURE_ROOMS).map(([id, label]) => <button type="button" key={id} className={styles.roomCard} onClick={() => setRoom(id)}>
          <CatalogNavigationImage room={id as FurnitureRoom} /><span className={styles.roomLabel}>{label}</span>
        </button>) : CATALOG_CATEGORIES.map(item => <button type="button" key={item.id} className={styles.roomCard} onClick={() => setCategory(item.id)}>
          <CatalogNavigationImage room={item.room} categoryId={item.id} /><span className={styles.roomLabel}>{item.label}</span>
        </button>)}
      </div><button type="button" className={styles.all} onClick={() => setAll(true)}>Ver todos los muebles</button>
    </> : <div className={styles.items}>{groups.map((variants) => <CatalogCard key={variants[0]!.productId} variants={variants} onAdd={onAdd} readOnly={readOnly} />)}</div>}
    {!showHome && !groups.length ? <div className={styles.empty}><p>No hay muebles con estos filtros.</p><button type="button" onClick={reset}>Limpiar filtros</button></div> : null}
    <p className={styles.note}>Elige un mueble y pulsa sobre el plano para colocarlo. Árboles, piscinas y vallas están en Exterior.</p>
  </aside>;
}
