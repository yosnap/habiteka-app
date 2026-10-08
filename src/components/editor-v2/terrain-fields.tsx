'use client';
import type { EditorDocument, TerrainSurface } from '@/lib/editor-document/schema';
import { updateTerrainSurface } from '@/lib/editor-document/terrain-surfaces';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { MeterField, NumberField } from './property-number-field';
import { SurfaceMaterialPicker } from './surface-material-picker';
import styles from './editor.module.css';

export function TerrainFields({ surface, edit }: {
  surface: TerrainSurface;
  edit: (operation: (document: EditorDocument) => EditorDocument) => boolean;
}) {
  const update = (patch: Partial<Omit<TerrainSurface, 'id'>>) => edit((document) => updateTerrainSurface(document, surface.id, patch));
  return <>
    <p className={styles.field}>Arrastra los bordes o esquinas para cambiar el tamaño y el control central para mover. Ajuste activa los imanes; también puedes escribir las medidas aquí.</p>
    <p className={styles.field}>Superficie: {(surface.widthMm * surface.depthMm / 1e6).toFixed(2)} m². Es un acabado exterior, no habilita pasos del recorrido.</p>
    <label className={styles.field}>Nombre<input key={surface.id} defaultValue={surface.name} maxLength={100}
      onBlur={(event) => { if (event.currentTarget.value !== surface.name) update({ name: event.currentTarget.value }); }} /></label>
    <div className={styles.fields}>
      {([['widthMm', 'Ancho'], ['depthMm', 'Fondo'], ['x', 'X'], ['y', 'Y']] as const).map(([key, label]) =>
        <MeterField key={key} label={label} valueMm={surface[key]} change={(value) => update({ [key]: value })} />)}
    </div>
    <label className={styles.field}>Color<input type="color" aria-label="Color del terreno" value={surface.color}
      onChange={(event) => update({ color: event.target.value })} /></label>
    <SurfaceMaterialPicker label="Material exterior" value={surface.texture} onChange={(id) => update({
      texture: (id ?? 'none') as TerrainSurface['texture'], color: '#ffffff', tileSizeMm: surfaceMaterial(id)?.sizeMm[0] ?? 1000,
    })} />
    <MeterField label="Tamaño de repetición" valueMm={surface.tileSizeMm} change={(tileSizeMm) => update({ tileSizeMm })} />
    <NumberField label="Giro de textura (°)" value={surface.rotation} change={(rotation) => update({ rotation })} />
  </>;
}
