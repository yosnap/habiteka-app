'use client';
import { useStore } from 'zustand';
import { AlignCenterHorizontal, Scissors, SlidersHorizontal, Trash2, X } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { deleteEntities, editDocument, newId } from '@/canvas/editor-v2/editing-operations';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { applyCommand } from '@/lib/editor-document/commands';
import { assertOpeningClearance } from '@/lib/editor-document/opening-clearance';
import { openingConstruction, wallConstruction } from '@/lib/editor-document/construction-properties';
import { setOpeningConstruction, setWallConstruction, updateRamp, updateStair } from '@/lib/editor-document/construction-commands';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import styles from './editor.module.css';
import { defaultWallCurve, setWallCurve } from '@/lib/editor-document/curve-commands';
import { CurvedWallIcon, StraightWallIcon } from './wall-action-icons';
import { isRampLanding } from '@/lib/editor-document/ramp-kind';
import { formatEditorDecimal, parseEditorDecimal } from './decimal-input';

type RampDimensionKey = 'widthMm' | 'depthMm' | 'riseMm' | 'elevationMm';

function MeasureField({ label, value, minimum = .001, unit = 'm', onCommit }: { label: string; value: number; minimum?: number; unit?: string; onCommit: (n: number) => boolean }) {
  const commit = (input: HTMLInputElement, next: number) => {
    if (!Number.isFinite(next) || next < minimum || !onCommit(next)) input.value = formatEditorDecimal(value);
  };
  return <label className={styles.measureField}><span>{label}</span><div><input key={value} type="text"
    aria-label={`${label} (${unit})`} defaultValue={formatEditorDecimal(value)} inputMode="decimal"
    onBlur={(event) => {
      const next = parseEditorDecimal(event.currentTarget.value);
      commit(event.currentTarget, next);
    }} onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.blur();
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const current = parseEditorDecimal(event.currentTarget.value), increment = unit === 'm' ? .01 : 1;
      commit(event.currentTarget, (Number.isFinite(current) ? current : value) + (event.key === 'ArrowUp' ? increment : -increment));
    }} /><span>{unit}</span></div></label>;
}

export function SelectionPropertiesBar({ store, onProperties }: { store: EditorStore; onProperties: () => void }) {
  const doc = useStore(store, (state) => state.document), selection = useStore(store, (state) => state.selection);
  const readOnly = useStore(store, (state) => state.readOnly), id = selection[0];
  const wall = doc.walls.find((item) => item.id === id), opening = doc.openings.find((item) => item.id === id);
  const furniture = doc.furniture.find((item) => item.id === id);
  const stair = doc.stairs?.find((item) => item.id === id);
  const ramp = doc.ramps?.find((item) => item.id === id);
  const landing = ramp && isRampLanding(ramp);
  const rampDimensions: readonly (readonly [RampDimensionKey, string])[] = !ramp ? [] : landing
    ? [['widthMm', 'Ancho'], ['depthMm', 'Fondo'], ['elevationMm', 'Cota superior desde suelo']]
    : [['widthMm', 'Ancho'], ['depthMm', 'Longitud'], ['riseMm', ramp.route ? 'Desnivel tramo 1' : 'Desnivel'], ['elevationMm', 'Elevación inicial']];
  const spatial = furniture ?? stair ?? ramp;
  if (!id) return null;
  const label = wall ? 'Pared' : opening ? opening.kind === 'puerta' ? 'Puerta' : opening.kind === 'ventana' ? 'Ventana' : 'Hueco'
    : stair ? 'Escalera' : landing ? 'Descansillo' : ramp ? 'Rampa' : furniture ? 'Elemento' : 'Selección';
  const run = (operation: (current: EditorDocument) => EditorDocument) => {
    try { const state = store.getState(); state.apply(operation(state.document)); return true; }
    catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo editar la selección.'); return false; }
  };
  return <section className={styles.propertiesBar} aria-label="Medidas de selección">
    <strong>{selection.length > 1 ? `${selection.length} elementos` : label}</strong>
    <fieldset disabled={readOnly} className={styles.propertyMeasures}>
      {spatial && (['x', 'y'] as const).map((key) => <MeasureField key={key} label={key.toUpperCase()} value={spatial[key] / 1000} minimum={-1000}
        onCommit={(n) => run((current) => furniture ? updateFurniture(current, id, { [key]: n * 1000 })
          : stair ? updateStair(current, id, { [key]: n * 1000 }) : updateRamp(current, id, { [key]: n * 1000 }))} />)}
      {wall && <>
        <MeasureField label="Curvatura" value={(wall.curveHeightMm ?? 0) / 1000} minimum={-1000}
          onCommit={(n) => run((current) => setWallCurve(current, id, n * 1000))} />
        <MeasureField label={wall.curveHeightMm ? 'Entre extremos' : 'Longitud'} value={distance(...wallPoints(doc, wall)) / 1000} onCommit={(n) => run((current) => {
          const target = current.walls.find((item) => item.id === id)!;
          const [a, b] = wallPoints(current, target), factor = n * 1000 / distance(a, b);
          return applyCommand(current, { type: 'move-vertex', vertexId: target.endVertexId,
            x: a.x + (b.x - a.x) * factor, y: a.y + (b.y - a.y) * factor });
        })} />
        <MeasureField label="Grosor" value={wall.thicknessMm / 1000} onCommit={(n) => run((current) => editDocument(current,
          (next) => { next.walls.find((item) => item.id === id)!.thicknessMm = n * 1000; }))} />
        <MeasureField label="Altura" value={wallConstruction(wall).heightMm / 1000}
          onCommit={(n) => run((current) => setWallConstruction(current, id, { heightMm: n * 1000 }))} />
        <MeasureField label="Cota base" value={(wall.baseElevationMm ?? 0) / 1000} minimum={0}
          onCommit={(n) => run((current) => setWallConstruction(current, id, { baseElevationMm: n * 1000 }))} />
      </>}
      {opening && <>
        <MeasureField label="Ancho" value={opening.widthMm / 1000} onCommit={(n) => run((current) => editDocument(current,
          (next) => { const target = next.openings.find((item) => item.id === id)!;
            target.widthMm = n * 1000; assertOpeningClearance(next, target); }))} />
        <MeasureField label="Altura" value={openingConstruction(opening).heightMm / 1000}
          onCommit={(n) => run((current) => setOpeningConstruction(current, id, { heightMm: n * 1000 }))} />
        <MeasureField label="Elevación" value={openingConstruction(opening).elevationMm / 1000} minimum={0}
          onCommit={(n) => run((current) => setOpeningConstruction(current, id, { elevationMm: n * 1000 }))} />
      </>}
      {stair && ([['widthMm', 'Ancho'], ['depthMm', 'Fondo'], ['heightMm', 'Altura'], ['elevationMm', 'Elevación']] as const).map(([key, text]) =>
        <MeasureField key={key} label={text} value={stair[key] / 1000}
          minimum={key === 'elevationMm' ? 0 : .01}
          onCommit={(n) => run((current) => updateStair(current, id, { [key]: n * 1000 }))} />)}
      {ramp && rampDimensions.map(([key, text]) =>
        <MeasureField key={key} label={text} value={ramp[key] / 1000} minimum={key === 'elevationMm' ? 0 : .001}
          onCommit={(n) => run((current) => updateRamp(current, id, { [key]: n * 1000 }))} />)}
      {ramp?.route && <MeasureField label="Cota final tramo 2" value={(ramp.elevationMm + ramp.riseMm + ramp.route.secondRiseMm) / 1000}
        minimum={(ramp.elevationMm + ramp.riseMm) / 1000 + .001} onCommit={(finalElevation) => run((current) => updateRamp(current, id, {
          route: { ...ramp.route!, secondRiseMm: finalElevation * 1000 - ramp.elevationMm - ramp.riseMm },
        }))} />}
      {furniture && <>
        {([['widthMm', 'Ancho'], ['depthMm', 'Fondo'], ['heightMm', 'Altura'], ['elevationMm', 'Elevación']] as const).map(([key, text]) =>
          <MeasureField key={key} label={text} value={({ ...furniture, ...furnitureSpatial(furniture) })[key] / 1000}
            minimum={key === 'elevationMm' ? 0 : .001} onCommit={(n) => run((current) => updateFurniture(current, id, { [key]: n * 1000 }))} />)}
      </>}
      {(furniture || stair || ramp) && <MeasureField label="Ángulo" unit="°" minimum={-36000} value={(furniture ?? stair ?? ramp)!.rotation}
        onCommit={(rotation) => run((current) => furniture ? updateFurniture(current, id, { rotation }) : stair ? updateStair(current, id, { rotation }) : updateRamp(current, id, { rotation }))} />}
    </fieldset>
    <div className={styles.propertyActions}>
      {wall && <button type="button" disabled={readOnly} onClick={() => run((d) => setWallCurve(d, id,
        wall.curveHeightMm ? 0 : defaultWallCurve(d, id)))}>{wall.curveHeightMm ? <StraightWallIcon size={20} aria-hidden="true" /> : <CurvedWallIcon size={20} aria-hidden="true" />}
        {wall.curveHeightMm ? 'Pared recta' : 'Curvar pared'}</button>}
      {(wall || opening || furniture || stair || ramp) && <>
        <button type="button" disabled={readOnly} onClick={() => store.getState().setDetailPanel('paint')}>Pintar</button>
        <button type="button" onClick={() => store.getState().setDetailPanel('comments')}>Comentarios ({doc.comments?.filter((c) => c.targetEntityId === id).length ?? 0})</button>
      </>}
      {opening && <button type="button" disabled={readOnly} onClick={() => run((current) => editDocument(current,
        (next) => { const target = next.openings.find((item) => item.id === id)!;
          target.position = .5; assertOpeningClearance(next, target); }))} title="Centrar en la pared" aria-label="Centrar en la pared">
        <AlignCenterHorizontal size={20} aria-hidden="true" /></button>}
      {wall && <button type="button" disabled={readOnly} title="Dividir pared por la mitad" aria-label="Dividir pared por la mitad"
        onClick={() => run((current) => applyCommand(current, { type: 'split-wall', wallId: id, position: .5, vertexId: newId(), newWallId: newId() }))}>
        <Scissors size={20} aria-hidden="true" /></button>}
      <button type="button" onClick={onProperties} title="Más propiedades" aria-label="Más propiedades"><SlidersHorizontal size={20} aria-hidden="true" /></button>
      <button type="button" disabled={readOnly} title="Eliminar selección" aria-label="Eliminar selección" onClick={() => {
        if (run((current) => deleteEntities(current, selection))) store.getState().select([]);
      }}><Trash2 size={20} aria-hidden="true" /></button>
      <button type="button" title="Cerrar selección" aria-label="Cerrar selección" onClick={() => store.getState().select([])}><X size={20} aria-hidden="true" /></button>
    </div>
  </section>;
}
