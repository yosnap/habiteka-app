'use client';

import { useMemo, type ReactNode } from 'react';
import { ShieldCheck, SlidersHorizontal, Sparkles, Sun, Sunset, Moon } from 'lucide-react';
import type { EditorDocument } from '@/lib/editor-document/schema';
import {
  RENDER_ADDITIONS,
  RENDER_ADDITION_LABELS,
  RENDER_VIEW_LABELS,
  RENDER_VIEWS,
  type RenderDesignOptions,
} from '@/lib/editor-document/render-design-options';
import {
  roomInteriorCameras,
  type RoomInteriorCamera,
} from '@/lib/editor-document/room-interior-cameras';
import InteriorRoomsPicker from './interior-rooms-picker';
import RenderRegionPicker from './render-region-picker';
import { ModernSelect } from '@/components/ui/modern-select';
import styles from './render-options-controls.module.css';

interface Props {
  document?: EditorDocument;
  options: RenderDesignOptions;
  onChange: (options: RenderDesignOptions) => void;
  disabled?: boolean;
  editable?: boolean;
}

export function RenderOptionsControls({ document, options, onChange, disabled, editable }: Props) {
  const update = (patch: Partial<RenderDesignOptions>) => onChange({ ...options, ...patch });
  const interiorCameras: RoomInteriorCamera[] = useMemo(
    () => (document ? roomInteriorCameras(document) : []),
    [document],
  );
  const interiorMode = options.interiorRoomIds.length > 0;
  const allViews = RENDER_VIEWS.filter((view) => view !== 'current');
  const toggleView = (view: RenderDesignOptions['views'][number]) =>
    update({
      views: options.views.includes(view)
        ? options.views.filter((item) => item !== view)
        : [...options.views, view],
    });
  const toggleAddition = (addition: RenderDesignOptions['additions'][number]) =>
    update({
      additions: options.additions.includes(addition)
        ? options.additions.filter((item) => item !== addition)
        : [...options.additions, addition],
    });
  return (
    <div className={`${styles.controls} mt-4 space-y-4`} aria-label="Opciones del render">
      {editable && <section>
        <label htmlFor="editor-design-preview-view" className="text-ink text-sm font-medium">Vista de referencia de la zona</label>
        <ModernSelect compact id="editor-design-preview-view" className="mt-2" value={options.views[0] ?? 'current'}
          disabled={disabled} onChange={(event) => update({ views: [event.target.value as RenderDesignOptions['views'][number]] })}>
          {RENDER_VIEWS.map((view) => <option key={view} value={view}>{RENDER_VIEW_LABELS[view]}</option>)}
        </ModernSelect>
        <p className="text-muted-foreground mt-1 text-xs">La vista previa usa el 3D editable y no consume créditos.</p>
      </section>}
      {!editable && <section>
        <h3 className="text-ink text-sm font-medium">Iluminación</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ['daylight', 'Día'],
              ['afternoon', 'Tarde'],
              ['warm', 'Atardecer'],
              ['evening', 'Noche'],
            ] as const
          ).map(([value, label]) => (
            <OptionButton
              key={value}
              active={options.lighting === value}
              disabled={disabled}
              onClick={() => update({ lighting: value })}
            >
              <span className="flex items-center gap-2">{value === 'daylight' || value === 'afternoon' ? <Sun size={17} aria-hidden="true" /> : value === 'warm' ? <Sunset size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}{label}</span>
            </OptionButton>
          ))}
        </div>
      </section>}
      {!editable && <section>
        <h3 className="text-ink text-sm font-medium">Diseño de la imagen</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <OptionButton active={!options.redesignInterior} disabled={disabled} onClick={() => update({ redesignInterior: false })}>Respetar diseño actual</OptionButton>
          <OptionButton active={options.redesignInterior} disabled={disabled} onClick={() => update({ redesignInterior: true })}>Rediseñar interiorismo</OptionButton>
        </div>
        <p className="mt-2 text-xs text-ink-soft">{options.redesignInterior ? 'Nuevos muebles móviles y acabados según tu estilo. Se conservan paredes, distribución y huecos; los fijos necesitan el permiso de debajo.' : 'Presenta el diseño existente con materiales y luz realistas. También puedes pedir un rediseño en las instrucciones.'}</p>
      </section>}
      <section>
        <h3 className="text-ink text-sm font-medium">Libertad de decoración</h3>
        <label className="my-2 flex items-start gap-2 text-xs">
          <input type="checkbox" disabled={disabled} checked={options.redesignFixed}
            onChange={(event) => update({ redesignFixed: event.target.checked })} />
          <span>{editable ? 'Rediseñar acabados de fijos existentes. Conserva medidas y posiciones; revisa cada cambio antes de aplicarlo.'
            : 'Rediseño: permitir cambiar cocina, isla, sanitarios y armarios empotrados. Puede requerir más inversión; muros y huecos se conservan.'}</span>
        </label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(
            [
              ['strict', 'Estricto', 'No añade objetos'],
              ['controlled', 'Controlado', 'Solo categorías marcadas'],
              ['free', 'Libre', 'Decoración sin construir'],
            ] as const
          ).map(([value, label, hint]) => (
            <OptionButton
              key={value}
              active={options.freedom === value}
              disabled={disabled}
              onClick={() => update({ freedom: value })}
            >
              <span className="flex items-center gap-2">{value === 'strict' ? <ShieldCheck size={17} aria-hidden="true" /> : value === 'controlled' ? <SlidersHorizontal size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}{label}</span>
              <small>{hint}</small>
            </OptionButton>
          ))}
        </div>
        {!editable && options.freedom !== 'strict' && (
          <p role="note" className="mt-2 rounded-control border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            Los objetos que la IA añada en la imagen no aparecerán en la visita libre ni en los vídeos del plano 3D. Los clips desde tus diseños sí usan las imágenes elegidas como referencia y requieren revisión.
            Para incorporarlos al 3D editable, propónlos en «Cambiar acabados y muebles», aplícalos y genera después la imagen en modo Estricto.
          </p>
        )}
        {options.freedom === 'controlled' && (
          <div className="bg-canvas mt-2 grid gap-1 rounded-control p-2 sm:grid-cols-2">
            {RENDER_ADDITIONS.map((addition) => (
              <label key={addition} className="text-ink-soft flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={options.additions.includes(addition)}
                  disabled={disabled}
                  onChange={() => toggleAddition(addition)}
                />
                {RENDER_ADDITION_LABELS[addition]}
              </label>
            ))}
          </div>
        )}
        {options.freedom === 'free' && (
          <p className="bg-canvas text-muted-foreground mt-2 rounded-control p-2 text-xs">
            La IA amueblará y decorará según el estilo elegido, sin tocar muros, huecos ni ninguna
            otra construcción del plano.
          </p>
        )}
      </section>
      {(!editable || (options.freedom !== 'strict' && options.designScope !== 'zone')) && (
        <section>
          <h3 className="text-ink text-sm font-medium">{editable ? 'Dónde añadir objetos dentro del ámbito' : 'Qué parte del inmueble diseñar'}</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <OptionButton
              active={options.placement === 'all' && (editable || options.designScope !== 'house')}
              disabled={disabled}
              onClick={() => update({ placement: 'all', ...(!editable ? { designScope: 'all' } : {}) })}
            >
              {editable ? 'Todo el ámbito' : 'Toda la planta'}
            </OptionButton>
            {!editable && <OptionButton active={options.designScope === 'house'} disabled={disabled}
              onClick={() => update({ designScope: 'house', placement: 'all', regions: [] })}>Solo la casa</OptionButton>}
            <OptionButton
              active={options.placement === 'selected'}
              disabled={disabled}
              onClick={() => update({ placement: 'selected', ...(!editable ? { designScope: 'all' } : {}) })}
            >
              {editable ? 'Zonas permitidas' : 'Zonas concretas'}
            </OptionButton>
          </div>
          {!editable && options.designScope === 'house' && <p className="mt-2 text-xs text-ink-soft">Solo las estancias interiores de esta planta y sus fachadas, sobre fondo neutro. Se excluyen parcela y patios.</p>}
          {options.placement === 'selected' && (
            <div className="mt-2">
              <p className="text-muted-foreground mb-2 text-xs">
                {editable
                  ? 'Los objetos nuevos deben caber dentro de estas zonas y del ámbito elegido.'
                  : 'La generación usa las zonas marcadas como límite. Cada imagen se verifica contra el 3D antes de guardarse.'}
              </p>
              <RenderRegionPicker
                document={document}
                regions={options.regions}
                onChange={(regions) => update({ regions })}
                disabled={disabled}
              />
            </div>
          )}
        </section>
      )}
      {editable && options.freedom !== 'strict' && options.designScope === 'zone' && (
        <p className="bg-canvas text-muted-foreground rounded-control p-2 text-xs">
          La zona dibujada define dónde pueden colocarse los objetos nuevos.
        </p>
      )}
      {!editable && (
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-ink text-sm font-medium">Vistas interiores por estancia</h3>
            <label className="text-ink-soft flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={interiorMode}
                disabled={disabled || !interiorCameras.length}
                onChange={(event) =>
                  update({
                    interiorRoomIds: event.target.checked
                      ? interiorCameras.filter((room) => room.habitable).map((room) => room.roomId)
                      : [],
                  })
                }
              />
              Activar
            </label>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Una imagen por estancia, tomada desde dentro a altura de ojos sobre la geometría real
            de tu plano. Es la forma de obtener perspectivas fieles a tus muros. Mientras esté
            activo, los ángulos generales no se usan.
          </p>
          {interiorMode || !interiorCameras.length ? (
            <InteriorRoomsPicker
              cameras={interiorCameras}
              selected={options.interiorRoomIds}
              disabled={disabled}
              onChange={(interiorRoomIds) => update({ interiorRoomIds })}
            />
          ) : null}
        </section>
      )}
      {!editable && !interiorMode && <section>
        <div className="flex items-center justify-between">
          <h3 className="text-ink text-sm font-medium">Ángulos del diseño</h3>
          <label className="text-ink-soft flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={allViews.every((view) => options.views.includes(view))}
              disabled={disabled}
              onChange={(event) =>
                update({
                  views: event.target.checked
                    ? allViews
                    : options.views.filter((view) => view === 'current'),
                })
              }
            />
            Todas ({allViews.length} sin actual)
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
          {RENDER_VIEWS.map((view) => (
            <label
              key={view}
              className={`${styles.viewChoice} flex items-center gap-2 rounded-control px-2 py-1.5 text-xs`}
            >
              <input
                type="checkbox"
                checked={options.views.includes(view)}
                disabled={disabled}
                onChange={() => toggleView(view)}
              />
              {RENDER_VIEW_LABELS[view]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">Exterior terminado conserva fachadas y tejado para el final de obra. Cenital, isométrica y dron muestran la distribución sin cubierta.</p>
      </section>}
    </div>
  );
}

function OptionButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`${styles.optionButton} ${active ? styles.active : ''}`}
    >
      {children}
    </button>
  );
}

export default RenderOptionsControls;
