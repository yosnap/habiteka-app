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
      {!editable && <section>
        <h3 className="text-ink text-sm font-medium">Iluminación</h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(
            [
              ['daylight', 'Día'],
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
              <span className="flex items-center gap-2">{value === 'daylight' ? <Sun size={17} aria-hidden="true" /> : value === 'warm' ? <Sunset size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}{label}</span>
            </OptionButton>
          ))}
        </div>
      </section>}
      <section>
        <h3 className="text-ink text-sm font-medium">Libertad de decoración</h3>
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
      {options.freedom !== 'strict' && (
        <section>
          <h3 className="text-ink text-sm font-medium">Dónde puede decorar</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <OptionButton
              active={options.placement === 'all'}
              disabled={disabled}
              onClick={() => update({ placement: 'all' })}
            >
              Toda la planta
            </OptionButton>
            <OptionButton
              active={options.placement === 'selected'}
              disabled={disabled}
              onClick={() => update({ placement: 'selected' })}
            >
              Zonas permitidas
            </OptionButton>
          </div>
          {options.placement === 'selected' && (
            <div className="mt-2">
              <p className="text-muted-foreground mb-2 text-xs">
                Fuera de las zonas marcadas no se añadirán objetos; los accesos se mantienen libres.
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
            Todas (7 sin actual)
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
