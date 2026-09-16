'use client';
import { ArrowLeftRight, DoorClosed, DoorOpen, FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import { ModernSelect } from '@/components/ui/modern-select';
import type { EditorDocument, Opening, Ramp, Stair, Wall } from '@/lib/editor-document/schema';
import { connectLandingEntrance, connectRampArrival, setOpeningConstruction, setWallConstruction, updateRamp, updateStair } from '@/lib/editor-document/construction-commands';
import { rampLayout } from '@/lib/editor-document/ramp-layout';
import { openingConstruction, wallConstruction } from '@/lib/editor-document/construction-properties';
import { stairLayout } from '@/lib/editor-document/stair-layout';
import { isRampLanding } from '@/lib/editor-document/ramp-kind';
import { MeterField, NumberField } from './property-number-field';
import styles from './editor.module.css';
import { wallFaces } from '@/lib/editor-document/wall-faces';
import { SurfaceMaterialPicker } from './surface-material-picker';
import { setWallSurface } from '@/lib/editor-document/spatial-commands';

type Edit = (operation: (document: EditorDocument) => EditorDocument) => boolean;
type RampDimensionKey = 'x' | 'y' | 'widthMm' | 'depthMm' | 'riseMm' | 'elevationMm';
function MaterialField({ label, value, change }: { label: string; value: string; change: (value: string) => void }) {
  return <SurfaceMaterialPicker label={label} value={value} onChange={(materialId) => change(materialId ?? 'concrete-grey')} />;
}

export function WallConstructionFields({ wall, document, edit }: { wall: Wall; document: EditorDocument; edit: Edit }) {
  const properties = wallConstruction(wall);
  return <>
    <MeterField label="Altura" valueMm={properties.heightMm} change={(heightMm) => edit((doc) => setWallConstruction(doc, wall.id, { heightMm }))} />
    <MeterField label="Cota base" valueMm={wall.baseElevationMm ?? 0}
      change={(baseElevationMm) => edit((doc) => setWallConstruction(doc, wall.id, { baseElevationMm }))} />
    {wallFaces(document, wall).map(({ side, label }) => <SurfaceMaterialPicker key={side} label={label}
      value={properties.materials[side]} onChange={(value) => edit((doc) => setWallSurface(doc, wall.id, side, value))} />)}
    <p className={styles.hint}>La altura se mide desde la cota base. Para un murete sobre un descansillo de 1 m, usa cota base 1 m. Cierra la habitación para identificar interior y exterior.</p>
  </>;
}

export function OpeningConstructionFields({ opening, edit }: { opening: Opening; edit: Edit }) {
  const properties = openingConstruction(opening), isDoor = opening.kind === 'puerta';
  return <>
    <div className={styles.fields}>
      <MeterField label="Altura" valueMm={properties.heightMm} change={(heightMm) => edit((doc) => setOpeningConstruction(doc, opening.id, { heightMm }))} />
      <MeterField label="Elevación" valueMm={properties.elevationMm} change={(elevationMm) => edit((doc) => setOpeningConstruction(doc, opening.id, { elevationMm }))} />
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
  const dimensions = [['x', 'X'], ['y', 'Y'], ['widthMm', 'Ancho'], ['depthMm', 'Fondo'],
    ['heightMm', 'Altura total'], ['elevationMm', 'Elevación']] as const;
  const layout = stairLayout(stair);
  return <>
    <label className={styles.field}>Forma<ModernSelect value={stair.kind} onChange={(event) => edit((doc) =>
      updateStair(doc, stair.id, { kind: event.target.value as Stair['kind'], catalogId: `builtin:stairs-${event.target.value}` }))}>
      <option value="straight">Recta</option><option value="L">En L</option><option value="U">En U</option>
    </ModernSelect></label>
    <div className={styles.fields}>{dimensions.map(([key, label]) => <MeterField key={key} label={label} valueMm={stair[key]}
      change={(value) => edit((doc) => updateStair(doc, stair.id, { [key]: value }))} />)}
      <NumberField label="Rotación (°)" value={stair.rotation} change={(rotation) => edit((doc) => updateStair(doc, stair.id, { rotation }))} />
      <NumberField label="Subidas" value={stair.stepCount} change={(stepCount) => edit((doc) => updateStair(doc, stair.id, { stepCount }))} /></div>
    <MaterialField label="Acabado transitable" value={stair.materialId} change={(materialId) => edit((doc) => updateStair(doc, stair.id, { materialId }))} />
    <div className={styles.actions}>
      <button type="button" onClick={() => edit((doc) => updateStair(doc, stair.id, { railingLeft: !(stair.railingLeft ?? true) }))}>
        {stair.railingLeft ?? true ? 'Ocultar pasamanos izquierdo' : 'Mostrar pasamanos izquierdo'}
      </button>
      <button type="button" onClick={() => edit((doc) => updateStair(doc, stair.id, { railingRight: !(stair.railingRight ?? true) }))}>
        {stair.railingRight ?? true ? 'Ocultar pasamanos derecho' : 'Mostrar pasamanos derecho'}
      </button>
      <button type="button" onClick={() => edit((doc) => updateStair(doc, stair.id, { railingLeft: false, railingRight: false }))}>Solo escalera</button>
    </div>
    <button type="button" onClick={() => edit((doc) => {
      const current = doc.stairs!.find((item) => item.id === stair.id)!;
      return updateStair(doc, stair.id, { rotation: (current.rotation + 90) % 360 });
    })}><ArrowLeftRight size={18} aria-hidden="true" />Girar 90°</button>
    <p className={styles.hint}>{layout.steps.length} peldaños y {layout.landings.length} descansillos. Los laterales de escaleras con giro conservan los pasamanos de protección exteriores. Modelo espacial, no certificación constructiva.</p>
  </>;
}

export function RampConstructionFields({ ramp, edit }: { ramp: Ramp; edit: Edit }) {
  const landing = isRampLanding(ramp);
  const dimensions: readonly (readonly [RampDimensionKey, string])[] = landing
    ? [['x', 'X'], ['y', 'Y'], ['widthMm', 'Ancho'], ['depthMm', 'Fondo'], ['elevationMm', 'Cota superior desde suelo']]
    : [['x', 'X'], ['y', 'Y'], ['widthMm', 'Ancho'], ['depthMm', 'Longitud'],
      ['riseMm', ramp.route ? 'Desnivel tramo 1' : 'Desnivel'], ['elevationMm', 'Elevación inicial']];
  const layout = rampLayout(ramp);
  const landingElevationMm = ramp.elevationMm + ramp.riseMm;
  return <>
    <div className={styles.fields}>{dimensions.map(([key, label]) => <MeterField key={key} label={label} valueMm={ramp[key]}
      change={(value) => edit((doc) => updateRamp(doc, ramp.id, { [key]: value }))} />)}
      <NumberField label="Rotación (°)" value={ramp.rotation} change={(rotation) => edit((doc) => updateRamp(doc, ramp.id, { rotation }))} /></div>
    <MaterialField label="Acabado transitable" value={ramp.materialId} change={(materialId) => edit((doc) => updateRamp(doc, ramp.id, { materialId }))} />
    {!landing && <div className={styles.actions}>
      <button type="button" onClick={() => edit((doc) => updateRamp(doc, ramp.id, { railingLeft: !(ramp.railingLeft ?? true) }))}>
        {ramp.railingLeft ?? true ? 'Ocultar pasamanos izquierdo' : 'Mostrar pasamanos izquierdo'}
      </button>
      <button type="button" onClick={() => edit((doc) => updateRamp(doc, ramp.id, { railingRight: !(ramp.railingRight ?? true) }))}>
        {ramp.railingRight ?? true ? 'Ocultar pasamanos derecho' : 'Mostrar pasamanos derecho'}
      </button>
      <button type="button" onClick={() => edit((doc) => updateRamp(doc, ramp.id, { railingLeft: false, railingRight: false }))}>Rampa sin pasamanos</button>
    </div>}
    {!landing && (!ramp.route ? <div className={styles.actions}>{(['left', 'right', 'reverse'] as const).map((turn) => <button key={turn} type="button" onClick={() => edit((doc) => updateRamp(doc, ramp.id, {
      route: { landingMm: ramp.widthMm, turn, secondDepthMm: ramp.depthMm, secondRiseMm: ramp.riseMm / 2 },
    }))}>Añadir descanso · girar {turn === 'left' ? 'izquierda' : turn === 'right' ? 'derecha' : '180°'}</button>)}</div>
      : <div className={styles.fields}>
        <MeterField label="Longitud tramo 2" valueMm={ramp.route.secondDepthMm} change={(secondDepthMm) => edit((doc) => updateRamp(doc, ramp.id, { route: { ...ramp.route!, secondDepthMm } }))} />
        <MeterField label="Cota final tramo 2" valueMm={landingElevationMm + ramp.route.secondRiseMm} change={(finalElevationMm) => edit((doc) => {
          const secondRiseMm = finalElevationMm - landingElevationMm;
          if (secondRiseMm <= 0) throw new Error('La cota final debe ser superior a la cota del descanso.');
          return updateRamp(doc, ramp.id, { route: { ...ramp.route!, secondRiseMm } });
        })} />
      </div>)}
    {ramp.route && <p className={styles.hint}>Cota del descanso e inicio del tramo 2: {(landingElevationMm / 1000).toFixed(2)} m. Cota final: {((landingElevationMm + ramp.route.secondRiseMm) / 1000).toFixed(2)} m.</p>}
    <button type="button" onClick={() => edit((doc) => updateRamp(doc, ramp.id, { rotation: (ramp.rotation + 90) % 360 }))}>
      <ArrowLeftRight size={18} aria-hidden="true" />Girar 90°</button>
    {!landing && <button type="button" onClick={() => edit((doc) => connectRampArrival(doc, ramp.id))}>Acoplar llegada: suelo + hueco</button>}
    {landing && <button type="button" onClick={() => edit((doc) => connectLandingEntrance(doc, ramp.id))}>Abrir entrada en pared</button>}
    <p className={styles.hint}>{landing
      ? 'Cota base fija: 0,00 m. El descansillo es un bloque sólido desde el suelo hasta su cota superior; si se acopla a una rampa o escalera, esta cota coincide con su llegada.'
      : `Pendiente ${layout.slopePercent.toFixed(1)}% (${layout.angleDeg.toFixed(1)}°). Los pasamanos siguen cada tramo inclinado. Modelo espacial, no certificación constructiva.`}</p>
  </>;
}
