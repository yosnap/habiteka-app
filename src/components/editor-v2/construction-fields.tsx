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
import { assertOpeningClearance } from '@/lib/editor-document/opening-clearance';
import { assertOpeningTypeWidth, openingControls, openingType, openingTypesFor } from '@/lib/editor-document/opening-types';
import { setOpeningType } from '@/lib/editor-document/opening-type-commands';
import { OpeningLookFields } from './opening-look-fields';
import { editDocument } from '@/canvas/editor-v2/editing-operations';
import { PropertySection } from './property-section';

type Edit = (operation: (document: EditorDocument) => EditorDocument) => boolean;
type RampDimensionKey = 'x' | 'y' | 'widthMm' | 'depthMm' | 'riseMm' | 'elevationMm';
function MaterialField({ label, value, change }: { label: string; value: string; change: (value: string) => void }) {
  return <SurfaceMaterialPicker label={label} value={value} onChange={(materialId) => change(materialId ?? 'concrete-grey')} />;
}

export function WallConstructionFields({ wall, document, edit, showSurfaceFields = true }: {
  wall: Wall; document: EditorDocument; edit: Edit; showSurfaceFields?: boolean;
}) {
  const properties = wallConstruction(wall);
  return <>
    <div className={styles.fields}>
    <MeterField label="Altura" valueMm={properties.heightMm} change={(heightMm) => edit((doc) => setWallConstruction(doc, wall.id, { heightMm }))} />
    <MeterField label="Cota base" valueMm={wall.baseElevationMm ?? 0}
      change={(baseElevationMm) => edit((doc) => setWallConstruction(doc, wall.id, { baseElevationMm }))} />
    </div>
    {showSurfaceFields && wallFaces(document, wall).map(({ side, label }) => <SurfaceMaterialPicker key={side} label={label}
      value={properties.materials[side]} onChange={(value) => edit((doc) => setWallSurface(doc, wall.id, side, value))} />)}
    <p>La altura se mide desde la cota base de la pared.</p>
  </>;
}

export function OpeningConstructionFields({ opening, edit, multiple = false }: { opening: Opening; edit: Edit; multiple?: boolean }) {
  const properties = openingConstruction(opening), type = openingType(opening), isDoor = opening.kind === 'puerta' && !multiple;
  // En selección múltiple solo se editan medidas: cada abertura validaría su tipo y su giro por separado.
  const controls = openingControls(multiple ? null : type);
  const toggle = (key: 'hinge' | 'swing') => edit((doc) => {
    const value = openingConstruction(doc.openings.find((item) => item.id === opening.id)!);
    return setOpeningConstruction(doc, opening.id, { [key]: value[key] === 'left' ? 'right' : 'left' });
  });
  return <>
    {type && !multiple && <PropertySection title="Tipo">
      <label className={styles.field}>Tipo<ModernSelect aria-label="Tipo" value={type.id}
        onChange={(event) => edit((doc) => setOpeningType(doc, opening.id, event.target.value))}>
        {openingTypesFor(type.kind).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </ModernSelect></label>
      <p className={styles.hint}>Al cambiar de tipo se aplican su ancho, altura, elevación y aspecto habituales si caben en el muro; si no, se conservan las medidas actuales. Este tipo admite hasta {(type.maxWidthMm / 1000).toFixed(2).replace('.', ',')} m de ancho.</p>
    </PropertySection>}
    {type && !multiple && <OpeningLookFields opening={opening} type={type} edit={edit} />}
    <PropertySection title="Dimensiones">
    <div className={styles.fields}>
      <MeterField label="Ancho" valueMm={opening.widthMm} change={(widthMm) => edit((doc) => editDocument(doc, (next) => {
        const target = next.openings.find((item) => item.id === opening.id)!;
        assertOpeningTypeWidth(openingType(target), widthMm);
        target.widthMm = widthMm; assertOpeningClearance(next, target);
      }))} />
      <MeterField label="Altura" valueMm={properties.heightMm} change={(heightMm) => edit((doc) => setOpeningConstruction(doc, opening.id, { heightMm }))} />
    </div>
    </PropertySection>
    <PropertySection title={isDoor ? 'Posición y apertura' : 'Posición'}>
    <div className={styles.fields}>
      <MeterField label="Elevación" valueMm={properties.elevationMm} change={(elevationMm) => edit((doc) => setOpeningConstruction(doc, opening.id, { elevationMm }))} />
      {!multiple && <NumberField label="Centro en muro (%)" value={opening.position * 100} change={(value) => edit((doc) => editDocument(doc, (next) => {
        const target = next.openings.find((item) => item.id === opening.id)!;
        target.position = value / 100; assertOpeningClearance(next, target);
      }))} />}
      {controls.angle && <NumberField label="Apertura (°)" value={properties.openAngleDeg} change={(openAngleDeg) => edit((doc) => setOpeningConstruction(doc, opening.id, { openAngleDeg }))} />}
    </div>
    {(controls.hinge || controls.swing || controls.toggle) && <div className={styles.actions}>
      {controls.hinge && <button type="button" onClick={() => toggle('hinge')}><FlipHorizontal2 size={18} aria-hidden="true" />{controls.hinge}</button>}
      {controls.swing && <button type="button" onClick={() => toggle('swing')}><FlipVertical2 size={18} aria-hidden="true" />{controls.swing}</button>}
      {controls.toggle && <button type="button" onClick={() => edit((doc) => {
        const value = openingConstruction(doc.openings.find((item) => item.id === opening.id)!);
        return setOpeningConstruction(doc, opening.id, { openAngleDeg: value.openAngleDeg > 0 ? 0 : 90 });
      })}>{properties.openAngleDeg > 0 ? <DoorClosed size={18} aria-hidden="true" /> : <DoorOpen size={18} aria-hidden="true" />}
        {properties.openAngleDeg > 0 ? 'Cerrar puerta' : 'Abrir puerta'}</button>}
    </div>}
    </PropertySection>
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
    <SurfaceMaterialPicker label="Contrahuellas, laterales y cara inferior" value={stair.bodyMaterialId}
      onChange={(bodyMaterialId) => edit((doc) => updateStair(doc, stair.id, { bodyMaterialId }))} />
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
    <SurfaceMaterialPicker label={landing ? 'Canto y cara inferior del descansillo' : 'Laterales y cara inferior de la rampa'} value={ramp.bodyMaterialId}
      onChange={(bodyMaterialId) => edit((doc) => updateRamp(doc, ramp.id, { bodyMaterialId }))} />
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
