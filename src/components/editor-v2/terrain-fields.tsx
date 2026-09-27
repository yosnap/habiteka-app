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
    <p className={styles.field}>Superficie visual exterior · no habilita pasos del recorrido.</p>
    <label className={styles.field}>Nombre<input key={surface.id} defaultValue={surface.name} maxLength={100}
      onBlur={(event) => { if (event.currentTarget.value !== surface.name) update({ name: event.currentTarget.value }); }} /></label>
    <div className={styles.fields}>
      {([['x', 'X'], ['y', 'Y'], ['widthMm', 'Ancho'], ['depthMm', 'Fondo']] as const).map(([key, label]) =>
        <MeterField key={key} label={label} valueMm={surface[key]} change={(value) => update({ [key]: value })} />)}
    </div>
    <label className={styles.field}>Color<input type="color" aria-label="Color del terreno" value={surface.color}
      onChange={(event) => update({ color: event.target.value })} /></label>
    <SurfaceMaterialPicker label="Terreno exterior" value={surface.texture} onChange={(id) => update({
      texture: (id ?? 'none') as TerrainSurface['texture'], color: '#ffffff', tileSizeMm: surfaceMaterial(id)?.sizeMm[0] ?? 1000,
    })} />
    <MeterField label="Tamaño de repetición" valueMm={surface.tileSizeMm} change={(tileSizeMm) => update({ tileSizeMm })} />
    <NumberField label="Giro de textura (°)" value={surface.rotation} change={(rotation) => update({ rotation })} />
  </>;
}
