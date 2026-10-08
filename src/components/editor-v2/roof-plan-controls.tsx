'use client';
import { MeterField, NumberField } from './property-number-field';
import { ROOF_OPENING_LABELS } from '@/lib/editor-document/roof-opening-types';
import type { RoofPlanTool } from './use-roof-plan-tool';
import { ModernSelect } from '@/components/ui/modern-select';
import type { RoofAction } from './use-roof-workflow';

export function RoofPlanControls({ tool, onClose, onAction }: { tool: RoofPlanTool; onClose: () => void; onAction?: (action: RoofAction) => void }) {
  const opening = tool.selected;
  return <section aria-label="Editar tejado en plano 2D" className="absolute left-3 top-3 z-10 max-h-[70%] w-[min(28rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border bg-surface p-3 text-sm shadow-lg">
    <div className="flex items-center justify-between gap-3"><strong>Editar tejado en plano 2D</strong><button type="button" onClick={onClose}>Ocultar tejado · cerrar edición</button></div>
    {onAction && <div className="my-2 flex flex-wrap gap-3"><button type="button" onClick={() => onAction('configure')}>Configurar tejado</button>
      <button type="button" disabled={!tool.doc.exteriorRoof} onClick={() => onAction('preview')}>Ver tejado en 3D</button></div>}
    <p className="my-2">El contorno gris es el tejado; las líneas discontinuas separan sus pendientes. Haz clic para colocar o arrastra para dibujar. Selecciona una pieza para moverla o cambiar su tamaño.</p>
    <fieldset disabled={tool.readOnly} className="space-y-3">
      {!tool.doc.exteriorRoof ? <button type="button" onClick={tool.addRoof}>Añadir tejado exterior</button> : <>
        <div className="flex flex-wrap gap-2"><button type="button" aria-pressed={tool.placing === 'glass'} onClick={() => tool.choose('glass')}>Añadir cristal</button>
          <button type="button" aria-pressed={tool.placing === 'roof-window'} onClick={() => tool.choose('roof-window')}>Añadir ventana de techo</button>
          <button type="button" aria-pressed={tool.placing === 'chimney'} onClick={() => tool.choose('chimney')}>Añadir salida de chimenea</button>
          {tool.placing && <button type="button" onClick={() => tool.choose(null)}>Cancelar dibujo</button>}</div>
        {tool.doc.exteriorRoof.voidCover === 'glass' && <button type="button" onClick={tool.convert}>Editar tamaño del cristal de los patios</button>}
        {!!tool.doc.exteriorRoof.openings?.length && <label className="block">Piezas del tejado<ModernSelect aria-label="Elegir pieza del tejado" value={opening?.id ?? ''}
          onChange={event => tool.setSelectedId(event.target.value || null)}><option value="">Selecciona una pieza</option>
          {tool.doc.exteriorRoof.openings.map((item, i) => <option key={item.id} value={item.id}>{ROOF_OPENING_LABELS[item.kind]} {i + 1}</option>)}</ModernSelect></label>}
        {opening && <>
          <strong>{ROOF_OPENING_LABELS[opening.kind]}</strong>
          <div className="grid grid-cols-2 gap-2">
            <MeterField label="Ancho proyectado" valueMm={opening.widthMm} change={widthMm => tool.update({ ...opening, widthMm })} />
            <MeterField label="Fondo proyectado" valueMm={opening.depthMm} change={depthMm => tool.update({ ...opening, depthMm })} />
            <MeterField label="Posición X" valueMm={opening.x} change={x => tool.update({ ...opening, x })} />
            <MeterField label="Posición Y" valueMm={opening.y} change={y => tool.update({ ...opening, y })} />
            <NumberField label="Giro (°)" value={opening.rotation} change={rotation => tool.update({ ...opening, rotation })} />
            {opening.kind === 'chimney' && <MeterField label="Altura sobre el tejado" valueMm={opening.heightMm ?? 1200} change={heightMm => tool.update({ ...opening, heightMm })} />}
          </div>
          <button type="button" onClick={tool.remove}>Eliminar {ROOF_OPENING_LABELS[opening.kind].toLowerCase()}</button>
          <p>{opening.kind === 'chimney' ? 'La chimenea es vertical. La altura se mide desde el punto más alto del tejado bajo ella; el sombrerete añade 28 cm. Se coloca la salida exterior, sin añadir una chimenea de salón.'
            : 'Las medidas son su proyección sobre el plano. En 3D sigue la pendiente del tejado. La ventana tiene marco y debe quedar en una sola pendiente.'}</p>
        </>}
      </>}
    </fieldset>
    {tool.placing && <p role="status" className="mt-2">Coloca {ROOF_OPENING_LABELS[tool.placing].toLowerCase()} con un clic, o arrastra un rectángulo (mínimo 20 × 20 cm). La vista previa roja indica una posición no válida.</p>}
    {tool.preview?.error && <p role="status" className="mt-2 text-red-700">{tool.preview.error}</p>}
    {tool.error && tool.error !== tool.preview?.error && <p role="alert" className="mt-2 text-red-700">{tool.error}</p>}
  </section>;
}
