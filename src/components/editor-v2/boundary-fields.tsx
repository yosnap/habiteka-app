'use client';
import type { EditorDocument, Furniture } from '@/lib/editor-document/schema';
import { boundaryDefaults, isBoundary, type BoundaryConstruction, type BoundaryGate } from '@/lib/editor-document/boundary-types';
import { addBoundaryGate, putBoundaryGate, splitBoundary, updateBoundary } from '@/lib/editor-document/boundary-commands';
import { MeterField, NumberField } from './property-number-field';
import { SurfaceMaterialPicker } from './surface-material-picker';
import styles from './editor.module.css';
import { ModernSelect } from '@/components/ui/modern-select';

export function BoundaryFields({ item, edit }: { item: Furniture; edit: (operation: (doc: EditorDocument) => EditorDocument) => boolean }) {
  const b = isBoundary(item) ? item : boundaryDefaults(item), c = b.construction;
  const change = (patch: Partial<BoundaryConstruction>) => edit((doc) => updateBoundary(doc, b.id, { construction: { ...c, ...patch } }));
  const gate = (g: BoundaryGate, patch: Partial<BoundaryGate>) => edit((doc) => putBoundaryGate(doc, b.id, { ...g, ...patch }));
  return <section aria-label="Composición del cerramiento">
    <h3>Cerramiento</h3>
    <label className={styles.field}>Composición<ModernSelect aria-label="Composición" value={c.baseHeightMm > 0 ? 'mixed' : 'fence'} onChange={(e) => change({ baseHeightMm: e.target.value === 'mixed' ? b.heightMm / 2 : 0 })}>
      <option value="fence">Solo valla / seto</option><option value="mixed">Muro inferior + valla / seto</option>
    </ModernSelect></label>
    <div className={styles.fields}>
      <MeterField label="Altura del muro inferior" valueMm={c.baseHeightMm} change={(baseHeightMm) => change({ baseHeightMm })} />
      <MeterField label="Altura de la parte superior" valueMm={b.heightMm - c.baseHeightMm} change={(value) => edit((doc) => updateBoundary(doc, b.id, { heightMm: c.baseHeightMm + value }))} />
    </div>
    <label className={styles.field}>Relleno superior<ModernSelect aria-label="Relleno superior" value={c.infill} onChange={(e) => change({ infill: e.target.value as BoundaryConstruction['infill'] })}>
      <option value="vertical">Lamas verticales</option><option value="horizontal">Lamas horizontales</option><option value="hedge">Seto vegetal</option>
    </ModernSelect></label>
    {c.infill !== 'hedge' && <div className={styles.fields}>
      <MeterField label="Ancho de lama" valueMm={c.slatWidthMm} change={(slatWidthMm) => change({ slatWidthMm })} />
      <MeterField label="Separación de lamas" valueMm={c.gapMm} change={(gapMm) => change({ gapMm })} />
    </div>}
    <label className={styles.field}>Sección de postes<ModernSelect aria-label="Sección de postes" value={c.postShape} onChange={(e) => change({ postShape: e.target.value as BoundaryConstruction['postShape'] })}>
      <option value="rectangle">Rectangular</option><option value="circle">Circular</option>
    </ModernSelect></label>
    <div className={styles.fields}>
      <MeterField label={c.postShape === 'circle' ? 'Diámetro del poste' : 'Ancho del poste'} valueMm={c.postSizeMm} change={(postSizeMm) => change({ postSizeMm })} />
      <MeterField label="Separación máxima de postes" valueMm={c.postSpacingMm} change={(postSpacingMm) => change({ postSpacingMm })} />
    </div>
    <label className={styles.field}>Color del muro inferior<input type="color" value={c.baseColor} onChange={(e) => change({ baseColor: e.target.value })} /></label>
    <label className={styles.field}>Color de la valla / seto<input type="color" value={b.color} onChange={(e) => edit((doc) => updateBoundary(doc, b.id, { color: e.target.value }))} /></label>
    <label className={styles.field}>Color de postes<input type="color" value={c.postColor} onChange={(e) => change({ postColor: e.target.value })} /></label>
    <SurfaceMaterialPicker label="Material del muro inferior" value={c.baseMaterialId} onChange={(baseMaterialId) => change({ baseMaterialId })} />
    <SurfaceMaterialPicker label="Material de la valla" value={c.infillMaterialId} onChange={(infillMaterialId) => change({ infillMaterialId })} />
    <SurfaceMaterialPicker label="Material de postes" value={c.postMaterialId} onChange={(postMaterialId) => change({ postMaterialId })} />
    <button type="button" onClick={() => edit((doc) => splitBoundary(doc, b.id, b.widthMm / 2))}>Dividir tramo al 50%</button>
    <h3>Puertas del cerramiento</h3>
    <p className={styles.hint}>La puerta abre un hueco en muro y valla. Su posición se mide desde el inicio del tramo.</p>
    <button type="button" onClick={() => edit((doc) => addBoundaryGate(doc, b.id))}>Añadir puerta peatonal</button>
    {c.gates.map((g, index) => <fieldset key={g.id} aria-label={`Puerta ${index + 1}`} style={{ marginTop: 16, padding: 8, border: '1px solid #ccd5d1' }}>
      <legend>Puerta {index + 1}</legend>
      <div className={styles.fields}>
        <MeterField label={`Centro de puerta ${index + 1}`} valueMm={g.positionMm} change={(positionMm) => gate(g, { positionMm })} />
        <MeterField label={`Ancho de puerta ${index + 1}`} valueMm={g.widthMm} change={(widthMm) => gate(g, { widthMm })} />
        <MeterField label={`Altura de puerta ${index + 1}`} valueMm={g.heightMm} change={(heightMm) => gate(g, { heightMm })} />
        <NumberField label={`Apertura de puerta ${index + 1} (°)`} value={g.openAngleDeg} change={(openAngleDeg) => gate(g, { openAngleDeg })} />
      </div>
      <label className={styles.field}>Bisagra<ModernSelect value={g.hinge} onChange={(e) => gate(g, { hinge: e.target.value as BoundaryGate['hinge'] })}><option value="left">Izquierda</option><option value="right">Derecha</option></ModernSelect></label>
      <label className={styles.field}>Color de puerta<input type="color" value={g.color} onChange={(e) => gate(g, { color: e.target.value })} /></label>
      <button type="button" onClick={() => gate(g, { openAngleDeg: g.openAngleDeg ? 0 : 90 })}>{g.openAngleDeg ? 'Cerrar puerta' : 'Abrir puerta'}</button>{' '}
      <button type="button" onClick={() => change({ gates: c.gates.filter((item) => item.id !== g.id) })}>Eliminar puerta</button>
    </fieldset>)}
  </section>;
}
