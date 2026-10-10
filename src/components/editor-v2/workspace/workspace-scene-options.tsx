'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Grid2X2,
  Layers,
  Paintbrush,
  Ruler,
  Search,
  SlidersHorizontal,
  Trees,
  House,
  Footprints,
  BrickWall,
  Check,
} from 'lucide-react';
import { EDITOR_SHORTCUTS } from '@/canvas/editor-v2/editor-shortcuts';
import { SCENE_STYLES, type SceneOptions } from './scene-options-state';
import { SCENE_LIGHTING_LABELS, type SceneLightingPreset } from '../scene/scene-lighting';
import type { CeilingViewOption } from '../scene/scene-view-controls';
import ui from './workspace-scene-options.module.css';

type Section = 'search' | 'floors' | 'walls' | 'style' | 'overlays' | 'units' | 'preview' | null;
export function WorkspaceSceneOptions({
  options,
  onChange,
  floors,
  onFloors,
  hasLevels,
  ceiling,
  onCeiling,
  cutaway,
  onCutaway,
  lighting,
  onLighting,
  onTop,
  onWalk,
  disabled,
  spatial,
}: {
  options: SceneOptions;
  onChange: (value: SceneOptions) => void;
  floors: 'solo' | 'stacked' | 'exploded';
  onFloors: (value: 'solo' | 'stacked' | 'exploded') => void;
  hasLevels: boolean;
  ceiling: CeilingViewOption;
  onCeiling: (value: CeilingViewOption) => void;
  cutaway: boolean;
  onCutaway: () => void;
  lighting: SceneLightingPreset;
  onLighting: (value: SceneLightingPreset) => void;
  onTop: () => void;
  onWalk: () => void;
  disabled: boolean;
  spatial: boolean;
}) {
  const [open, setOpen] = useState(false),
    [section, setSection] = useState<Section>(null),
    [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    search = useRef<HTMLInputElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (disabled) return;
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        EDITOR_SHORTCUTS.commands.keys.includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
        setSection('search');
        setQuery('');
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const resize = () => {
      if (root.current) root.current.style.setProperty('--scene-options-available', `${Math.max(80, window.innerHeight - root.current.getBoundingClientRect().bottom - 26)}px`);
    };
    resize();
    const observer = new ResizeObserver(resize);
    const scene = root.current?.closest('[data-workspace-scene]');
    if (scene) observer.observe(scene);
    window.addEventListener('resize', resize);
    if (section === 'search') search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', resize);
      observer.disconnect();
    };
  }, [open, section]);
  const patch = (value: Partial<SceneOptions>) => onChange({ ...options, ...value });
  const actions = [
    { label: 'Solo planta activa', run: () => onFloors('solo'), disabled: !spatial },
    { label: 'Plantas apiladas', run: () => onFloors('stacked'), disabled: !spatial || !hasLevels },
    {
      label: 'Plantas separadas',
      run: () => onFloors('exploded'),
      disabled: !spatial || !hasLevels,
    },
    { label: 'Vista superior', run: onTop, disabled: false },
    {
      label: ceiling === 'hidden' ? 'Mostrar techo y cubierta' : 'Ocultar techo y cubierta',
      run: () => onCeiling(ceiling === 'hidden' ? 'solid' : 'hidden'),
      disabled: !spatial,
    },
    {
      label: options.walls ? 'Ocultar paredes' : 'Mostrar paredes',
      run: () => patch({ walls: !options.walls }),
      disabled: false,
    },
    {
      label: options.garden ? 'Ocultar jardín y terreno' : 'Mostrar jardín y terreno',
      run: () => patch({ garden: !options.garden }),
      disabled: false,
    },
    {
      label: options.grid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula',
      run: () => patch({ grid: !options.grid }),
      disabled: false,
    },
    {
      label: options.names ? 'Ocultar nombres' : 'Mostrar nombres',
      run: () => patch({ names: !options.names }),
      disabled: false,
    },
    {
      label: options.dimensions ? 'Ocultar medidas' : 'Mostrar medidas',
      run: () => patch({ dimensions: !options.dimensions }),
      disabled: false,
    },
    { label: 'Caminar por el plano guía', run: onWalk, disabled: !spatial },
    ...Object.entries(SCENE_STYLES).map(([style, value]) => ({
      label: `Estilo ${value.label}`,
      run: () => patch({ style: style as SceneOptions['style'] }),
      disabled: false,
    })),
    { label: 'Unidades en metros', run: () => patch({ units: 'metric' }), disabled: false },
    { label: 'Unidades en pies', run: () => patch({ units: 'imperial' }), disabled: false },
  ];
  const choose = (label: string, selected: boolean, action: () => void, unavailable = false) => (
    <button
      key={label}
      type="button"
      aria-pressed={selected}
      disabled={disabled || unavailable}
      onClick={action}
    >
      <span>{label}</span>
      {selected && <Check size={16} aria-hidden="true" />}
    </button>
  );
  return (
    <div
      className={ui.root}
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className={ui.trigger}
        type="button"
        aria-label="Opciones de escena"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setSection(null);
        }}
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span>Opciones</span>
      </button>
      {open && (
        <div className={ui.menu} aria-label="Opciones de escena">
          {section && (
            <button type="button" onClick={() => setSection(null)}>
              <ArrowLeft size={16} />
              Volver a Opciones
            </button>
          )}
          {!section && (
            <>
              <button type="button" onClick={() => setSection('search')}>
                <Search size={17} />
                <span>
                  Buscar comandos<small>Encuentra una acción</small>
                </span>
                <kbd>{EDITOR_SHORTCUTS.commands.label}</kbd>
              </button>
              {(
                [
                  ['floors', Layers, 'Plantas', 'Apiladas, separadas o solo una'],
                  ['walls', BrickWall, 'Paredes y exterior', 'Visibilidad del edificio y jardín'],
                  ['style', Paintbrush, 'Estilo de escena', 'Colores e iluminación'],
                  ['overlays', Grid2X2, 'Superposiciones', 'Cuadrícula, nombres y medidas'],
                  ['units', Ruler, 'Medidas y escala', 'Metros, pies y paso de cuadrícula'],
                  ['preview', Footprints, 'Explorar', 'Comprobar el plano caminando'],
                ] as const
              ).map(([id, Icon, label, hint]) => (
                <button key={id} type="button" onClick={() => setSection(id)}>
                  <Icon size={17} />
                  <span>
                    {label}
                    <small>{hint}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
              <button
                type="button"
                disabled={disabled || !spatial}
                onClick={() => onCeiling(ceiling === 'hidden' ? 'solid' : 'hidden')}
              >
                <House size={17} />
                <span>
                  {ceiling === 'hidden' ? 'Mostrar techo y cubierta' : 'Ocultar techo y cubierta'}
                </span>
              </button>
            </>
          )}
          {section === 'search' && (
            <>
              <input
                ref={search}
                aria-label="Buscar comandos"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Plantas, cuadrícula, techo…"
              />
              {actions
                .filter((a) => a.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
                .map((a) => (
                  <button
                    type="button"
                    key={a.label}
                    disabled={disabled || a.disabled}
                    onClick={() => {
                      a.run();
                      close();
                    }}
                  >
                    {a.label}
                  </button>
                ))}
            </>
          )}
          {section === 'floors' && (
            <>
              {choose(
                'Apiladas',
                floors === 'stacked',
                () => onFloors('stacked'),
                !hasLevels || !spatial,
              )}
              {choose(
                'Separadas',
                floors === 'exploded',
                () => onFloors('exploded'),
                !hasLevels || !spatial,
              )}
              {choose(
                'Solo planta activa, sin techo',
                floors === 'solo',
                () => onFloors('solo'),
                !spatial,
              )}
              <button type="button" disabled={disabled} onClick={onTop}>
                Vista superior
              </button>
            </>
          )}
          {section === 'walls' && (
            <>
              {choose('Mostrar paredes', options.walls, () => patch({ walls: !options.walls }))}
              {choose('Abrir muros hacia la cámara', cutaway, onCutaway, !spatial)}
              {choose('Mostrar jardín y terreno', options.garden, () =>
                patch({ garden: !options.garden }),
              )}
              <Trees size={16} aria-hidden="true" />
            </>
          )}
          {section === 'style' && (
            <>
              {Object.entries(SCENE_STYLES).map(([id, style]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={options.style === id}
                  disabled={disabled}
                  onClick={() => patch({ style: id as SceneOptions['style'] })}
                >
                  <span className={ui.swatch} style={{ background: style.background }} />
                  <span>{style.label}</span>
                  {options.style === id && <Check size={15} />}
                </button>
              ))}
              <p className={ui.hint}>Iluminación y sombras</p>
              {Object.entries(SCENE_LIGHTING_LABELS).map(([id, label]) =>
                choose(label, lighting === id, () => onLighting(id as SceneLightingPreset)),
              )}
            </>
          )}
          {section === 'overlays' && (
            <>
              {choose('Cuadrícula', options.grid, () => patch({ grid: !options.grid }))}
              {choose('Nombres de estancias', options.names, () =>
                patch({ names: !options.names }),
              )}
              {choose('Medidas generales', options.dimensions, () =>
                patch({ dimensions: !options.dimensions }),
              )}
            </>
          )}
          {section === 'units' && (
            <>
              {choose('Métricas · metros', options.units === 'metric', () =>
                patch({ units: 'metric' }),
              )}
              {choose('Imperiales · pies', options.units === 'imperial', () =>
                patch({ units: 'imperial' }),
              )}
              <p className={ui.hint}>Paso de cuadrícula</p>
              {[0.5, 1, 2, 5].map((value) => choose(
                `Paso ${value} ${options.units === 'metric' ? 'm' : 'ft'}`,
                options.gridStep === value,
                () => patch({ gridStep: value }),
              ))}
              <p className={ui.hint}>
                Unidades de visualización. Los campos de construcción conservan metros y la
                geometría no cambia de escala.
              </p>
            </>
          )}
          {section === 'preview' && (
            <>
              <button
                type="button"
                disabled={disabled || !spatial}
                onClick={() => {
                  onWalk();
                  close();
                }}
              >
                <Footprints size={17} />
                Caminar por el plano guía
              </button>
              <p className={ui.hint}>
                Pulsa sobre suelo visible para desplazarte. Las visitas finales del inmueble
                requieren diseños IA aceptados.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
