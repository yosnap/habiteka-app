'use client';
import { ArrowLeftRight, DoorClosed, DoorOpen, FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import type { EditorDocument, Opening, Stair, Wall } from '@/lib/editor-document/schema';
import { setOpeningConstruction, setWallConstruction, updateStair } from '@/lib/editor-document/construction-commands';
import { openingConstruction, wallConstruction } from '@/lib/editor-document/construction-properties';
import { stairLayout } from '@/lib/editor-document/stair-layout';
import { NumberField } from './property-number-field';
import styles from './editor.module.css';

type Edit = (operation: (document: EditorDocument) => EditorDocument) => boolean;
const materials = [
  ['plaster-white', 'Yeso blanco'], ['brick-red', 'Ladrillo rojo'], ['concrete-grey', 'Hormigón'],
  ['paint-sage', 'Pintura salvia'], ['oak-natural', 'Roble natural'], ['steel-dark', 'Metal oscuro'],
] as const;
function MaterialField({ label, value, change }: { label: string; value: string; change: (value: string) => void }) {
  return <label className={styles.field}>{label}<select value={value} onChange={(event) => change(event.target.value)}>
    {!materials.some(([id]) => id === value) && <option value={value}>Material actual</option>}
    {materials.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
  </select></label>;
}

export function WallConstructionFields({ wall, edit }: { wall: Wall; edit: Edit }) {
  const properties = wallConstruction(wall);
  return <>
    <NumberField label="Altura (mm)" value={properties.heightMm} change={(heightMm) => edit((doc) => setWallConstruction(doc, wall.id, { heightMm }))} />
    {(['left', 'right'] as const).map((side) => <MaterialField key={side} label={`Material · cara ${side === 'left' ? 'izquierda' : 'derecha'}`}
      value={properties.materials[side]} change={(value) => edit((doc) => {
        const current = doc.walls.find((item) => item.id === wall.id)!;
        return setWallConstruction(doc, wall.id, { materials: { ...wallConstruction(current).materials, [side]: value } });
      })} />)}
    <p className={styles.hint}>Las caras se refieren al sentido de la pared. Los materiales se muestran en 3D.</p>
  </>;
}

export function OpeningConstructionFields({ opening, edit }: { opening: Opening; edit: Edit }) {
  const properties = openingConstruction(opening), isDoor = opening.kind === 'puerta';
  return <>
    <div className={styles.fields}>
      <NumberField label="Altura (mm)" value={properties.heightMm} change={(heightMm) => edit((doc) => setOpeningConstruction(doc, opening.id, { heightMm }))} />
      <NumberField label="Elevación (mm)" value={properties.elevationMm} change={(elevationMm) => edit((doc) => setOpeningConstruction(doc, opening.id, { elevationMm }))} />
      {isDoor && <NumberField label="Apertura (°)" value={properties.openAngleDeg} change={(openAngleDeg) => edit((doc) => setOpeningConstruction(doc, opening.id, { openAngleDeg }))} />}
    </div>
    {isDoor && <div className={styles.actions}>
      <button type="button" onClick={() => edit((doc) => {
        const value = openingConstruction(doc.openings.find((item) => item.id === opening.id)!);
        return setOpeningConstruction(doc, opening.id, { hinge: value.hinge === 'left' ? 'right' : 'left' });
      })}><FlipHorizontal2 size={18} aria-hidden="true" />Cambiar bisagra</button>
      <button type="button" onClick={() => edit((doc) => {
        const value = openingConstruction(doc.openings.find((item) => item.id === opening.id)!);
        return setOpeningConstruction(doc, opening.id, { swing: value.swing === 'left' ? 'right' : 'left' });
      })}><FlipVertical2 size={18} aria-hidden="true" />Invertir apertura</button>
      <button type="button" onClick={() => edit((doc) => {
        const value = openingConstruction(doc.openings.find((item) => item.id === opening.id)!);
        return setOpeningConstruction(doc, opening.id, { openAngleDeg: value.openAngleDeg > 0 ? 0 : 90 });
      })}>{properties.openAngleDeg > 0 ? <DoorClosed size={18} aria-hidden="true" /> : <DoorOpen size={18} aria-hidden="true" />}
        {properties.openAngleDeg > 0 ? 'Cerrar puerta' : 'Abrir puerta'}</button>
    </div>}
  </>;
}

export function StairConstructionFields({ stair, edit }: { stair: Stair; edit: Edit }) {
  const fields = [['x', 'X (mm)'], ['y', 'Y (mm)'], ['widthMm', 'Ancho (mm)'], ['depthMm', 'Fondo (mm)'],
    ['heightMm', 'Altura total (mm)'], ['elevationMm', 'Elevación (mm)'], ['rotation', 'Rotación (°)'], ['stepCount', 'Subidas']] as const;
  const layout = stairLayout(stair);
  return <>
    <label className={styles.field}>Forma<select value={stair.kind} onChange={(event) => edit((doc) =>
      updateStair(doc, stair.id, { kind: event.target.value as Stair['kind'], catalogId: `builtin:stairs-${event.target.value}` }))}>
      <option value="straight">Recta</option><option value="L">En L</option><option value="U">En U</option>
    </select></label>
    <div className={styles.fields}>{fields.map(([key, label]) => <NumberField key={key} label={label} value={stair[key]}
      change={(value) => edit((doc) => updateStair(doc, stair.id, { [key]: value }))} />)}</div>
    <MaterialField label="Material" value={stair.materialId} change={(materialId) => edit((doc) => updateStair(doc, stair.id, { materialId }))} />
    <button type="button" onClick={() => edit((doc) => {
      const current = doc.stairs!.find((item) => item.id === stair.id)!;
      return updateStair(doc, stair.id, { rotation: (current.rotation + 90) % 360 });
    })}><ArrowLeftRight size={18} aria-hidden="true" />Girar 90°</button>
    <p className={styles.hint}>{layout.steps.length} peldaños y {layout.landings.length} descansillos. Modelo espacial, no certificación constructiva.</p>
  </>;
}
