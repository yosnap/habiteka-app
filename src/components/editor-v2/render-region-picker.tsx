'use client';

import { useState } from 'react';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { MAX_REGIONS, uniqueRegionName } from '@/lib/editor-document/render-region-draw';
import { ZoneDrawCanvas } from './zone-draw-canvas';

interface Props {
  document?: EditorDocument;
  regions: RenderDesignOptions['regions'];
  onChange: (regions: RenderDesignOptions['regions']) => void;
  disabled?: boolean;
}

/** Selector 2D: las zonas se guardan en milímetros del documento, nunca en píxeles de cámara. */
export function RenderRegionPicker({ document, regions, onChange, disabled }: Props) {
  const [name, setName] = useState('Zona permitida');
  const full = regions.length >= MAX_REGIONS;
  const savedZones = document?.designZones ?? [];

  const addRegion = (polygon: Point[], label: string) => {
    onChange([
      ...regions,
      {
        id: crypto.randomUUID(),
        name: uniqueRegionName(
          label,
          regions.map((region) => region.name),
        ),
        polygon,
      },
    ]);
  };

  return (
    <div className="space-y-2">
      {savedZones.length > 0 && (
        <div className="bg-canvas rounded-control border border-line p-2">
          <p className="text-ink-soft mb-2 text-xs">Usa una zona guardada para mantener exactamente su contorno.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Zonas guardadas del plano">
            {savedZones.map((zone) => {
              const selected = regions.some((region) => region.id === zone.id);
              return <button key={zone.id} type="button" aria-pressed={selected}
                disabled={disabled || (!selected && full)}
                onClick={() => onChange(selected
                  ? regions.filter((region) => region.id !== zone.id)
                  : [...regions, { id: zone.id, name: zone.name, polygon: zone.polygon.map((point) => ({ ...point })) }])}
                className={`rounded-control border px-2 py-1 text-xs ${selected ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-line bg-surface text-ink'}`}>
                {zone.name}
              </button>;
            })}
          </div>
        </div>
      )}
      <ZoneDrawCanvas
        document={document}
        zones={regions}
        snapToWalls={false}
        name={name}
        onNameChange={setName}
        onPolygon={addRegion}
        disabled={disabled}
        full={full}
        fullMessage={`Máximo de ${MAX_REGIONS} zonas alcanzado.`}
        label="Mapa 2D del documento para seleccionar zonas permitidas"
      />
      {regions.length > 0 && (
        <ul className="space-y-1" aria-label="Zonas permitidas marcadas">
          {regions.map((region) => (
            <li
              key={region.id}
              className="bg-canvas flex items-center gap-2 rounded-control px-2 py-1 text-xs"
            >
              <input
                value={region.name}
                disabled={disabled}
                maxLength={80}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                aria-label={`Nombre de la zona ${region.name}`}
                onChange={(event) =>
                  onChange(
                    regions.map((item) =>
                      item.id === region.id
                        ? { ...item, name: event.target.value.slice(0, 80) || item.name }
                        : item,
                    ),
                  )
                }
                className="border-line bg-surface min-w-0 flex-1 rounded-control border px-2 py-1 text-xs"
              />
              <span className="text-muted-foreground">{region.polygon.length} vértices</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(regions.filter((item) => item.id !== region.id))}
                className="text-destructive underline-offset-2 hover:underline"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RenderRegionPicker;
