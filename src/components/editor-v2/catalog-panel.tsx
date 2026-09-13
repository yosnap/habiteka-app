'use client';
import { useMemo, useState } from 'react';
import { FURNITURE_CATALOG, FURNITURE_ROOMS, searchFurnitureCatalog,
  type FurnitureCatalogEntry, type FurnitureProfile } from '@/lib/editor-document/furniture-catalog';
import styles from './catalog-panel.module.css';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';

const stylesAvailable = [...new Set(FURNITURE_CATALOG.map((item) => item.style))].sort();
const measure = new Intl.NumberFormat('es', { maximumFractionDigits: 1 });
function Thumbnail({ item }: { item: FurnitureCatalogEntry }) {
  const paths: Record<FurnitureProfile, string> = {
    sofa: 'M22 42V25Q22 19 28 19H72Q78 19 78 25V42M18 32H28V52H72V32H82V57H18ZM28 38H72M50 21V38',
    bed: 'M22 57V18H78V57M22 48H78M27 24H47V34H27ZM53 24H73V34H53ZM22 38H78',
    chair: 'M35 36V15H65V36M30 36H70V43H30ZM34 43V59M66 43V59',
    table: 'M16 25H84V34H16ZM24 34V58M76 34V58',
    cabinet: 'M24 16H76V55H24ZM50 16V55M44 32V40M56 32V40M29 55V60M71 55V60',
    shelf: 'M25 12H75V60M25 60V12M25 28H75M25 44H75M31 15V26M37 17V26M44 14V26M57 32V42M65 31V42',
    kitchen: 'M16 23H84V31H16ZM21 31H79V58H21ZM50 31V58M27 39H44M56 39H73',
    sink: 'M18 28H82V58H18ZM30 28Q30 45 50 45Q70 45 70 28M47 27V17Q47 10 55 10V18',
    toilet: 'M34 12H66V30H34ZM29 32Q50 22 71 32L65 48H35ZM40 48V58H60V48',
    bath: 'M14 23Q50 14 86 23L79 50Q50 59 21 50ZM22 25Q50 20 78 25M28 53V59M72 53V59',
    shower: 'M18 49H82V59H18ZM26 49V13H59V22M50 22H68M54 28V33M63 28V33',
    lamp: 'M37 13H63L73 34H27ZM50 34V57M34 58H66',
    plant: 'M36 42H64L60 59H40ZM50 42V19M50 30Q21 30 28 12Q48 11 50 30ZM50 23Q55 3 74 12Q73 29 50 32',
    rug: 'M19 19H81V55H19ZM25 25H75V49H25M14 22H19M14 30H19M14 38H19M14 46H19M81 22H86M81 30H86M81 38H86M81 46H86',
    curtain: 'M18 12H82M24 14V59H45V14M55 14V59H76V14M31 16V56M39 16V56M62 16V56M70 16V56',
    appliance: 'M28 10H72V60H28ZM28 23H72M36 15H40M48 15H52M62 15H66M39 31H61V51H39Z',
    screen: 'M17 13H83V45H17ZM22 18H78V40H22M50 45V57M36 58H64',
    bench: 'M18 30H82V39H18ZM26 39V58M74 39V58',
  };
  return <svg viewBox="0 0 100 72" width="100" height="72" aria-hidden="true" className={styles.thumbnail}>
    <ellipse cx="50" cy="62" rx="34" ry="3" fill="currentColor" opacity=".08" />
    <path d={paths[item.profile]} fill={item.color} fillOpacity=".65" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>;
}
function CatalogCard({ variants, onAdd, readOnly }: { variants: FurnitureCatalogEntry[]; onAdd: (item: FurnitureCatalogEntry) => void; readOnly: boolean }) {
  const [selectedId, setSelectedId] = useState(variants[0]!.id);
  const item = variants.find((entry) => entry.id === selectedId) ?? variants[0]!;
  const asset = furnitureAsset({ catalogId: item.id });
  return <article className={styles.card}>
    <Thumbnail item={item} />
    <h3>{item.label}</h3>
    <p className={styles.dimensions}>{[item.widthMm, item.depthMm, item.heightMm].map((n) => measure.format(n / 1000)).join(' × ')} m</p>
    <p className={styles.material}>{item.material} · {item.style}</p>
    {asset && <details className={styles.material}><summary>Modelo GLB · créditos</summary>
      <p>{asset.author} · {asset.license}</p><p>{asset.source}</p>
      <p>Adaptado en tamaño/orientación; tinte opcional. Símbolo 2D aproximado y colisión por caja conservadora.</p>
      {asset.attributionRequired && <p><a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa" target="_blank" rel="noreferrer">Modelo original</a>{' · '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">Licencia CC BY 4.0</a></p>}
    </details>}
    {variants.length > 1 ? <label className={styles.variant}>Variante
      <select value={item.id} onChange={(event) => setSelectedId(event.target.value)} aria-label={`Variante de ${item.label}`}>
        {variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.variantLabel}</option>)}
      </select>
    </label> : null}
    <button type="button" className={styles.add} disabled={readOnly} onClick={() => onAdd(item)} aria-label={`Añadir ${item.label}${item.variantLabel !== 'Original' ? ` · ${item.variantLabel}` : ''}`}>Añadir al plano</button>
  </article>;
}
export function CatalogPanel({ onAdd, onClose, readOnly = false }: {
  onAdd: (item: FurnitureCatalogEntry) => void; onClose: () => void; readOnly?: boolean;
}) {
  const [query, setQuery] = useState(''), [room, setRoom] = useState(''), [style, setStyle] = useState('');
  const groups = useMemo(() => {
    const result = new Map<string, FurnitureCatalogEntry[]>();
    for (const item of searchFurnitureCatalog(query, room, style)) result.set(item.productId, [...(result.get(item.productId) ?? []), item]);
    return [...result.values()];
  }, [query, room, style]);
  const reset = () => { setQuery(''); setRoom(''); setStyle(''); };
  return <aside className={styles.catalog} aria-label="Catálogo de muebles" onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
  }}>
    <header className={styles.heading}><h2>Amueblar</h2><button type="button" onClick={onClose} aria-label="Cerrar catálogo">Cerrar</button></header>
    <div className={styles.filters}>
      <label>Buscar mueble<input type="search" name="furniture-search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sofá, mesa, lavabo…" /></label>
      <div className={styles.filterRow}>
        <label>Estancia<select value={room} onChange={(event) => setRoom(event.target.value)}>
          <option value="">Todas las estancias</option>{Object.entries(FURNITURE_ROOMS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label>Estilo<select value={style} onChange={(event) => setStyle(event.target.value)}>
          <option value="">Todos los estilos</option>{stylesAvailable.map((label) => <option key={label}>{label}</option>)}
        </select></label>
      </div>
      <p className={styles.count} aria-live="polite">{groups.length} elementos · ancho × fondo × alto</p>
      {readOnly ? <p>Solo lectura: puedes explorar, pero no añadir muebles.</p> : null}
    </div>
    <div className={styles.items}>{groups.map((variants) => <CatalogCard key={variants[0]!.productId} variants={variants} onAdd={onAdd} readOnly={readOnly} />)}</div>
    {!groups.length ? <div className={styles.empty}><p>No hay muebles con estos filtros.</p><button type="button" onClick={reset}>Limpiar filtros</button></div> : null}
    <p className={styles.note}>Modelos editables. Las lámparas de mesa y monitores se añaden elevados; ajusta su altura de apoyo en propiedades.</p>
  </aside>;
}
