'use client';

/**
 * Asistente de diseño guiado (F7.4/F7.8), estilo Planner5D. Desde una zona vacía guía al
 * usuario: medidas de la sala (con sliders y previsualización en vivo) → tipo de sala → crear.
 * Genera un `CanvasDoc` con el contorno de muros (lógica pura `buildRoomDoc`) y lo entrega al
 * workspace, que lo amuebla según el tipo, lo carga y lo persiste.
 *
 * Diálogo accesible (rol dialog + Escape). Se puede saltar para dibujar a mano.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { buildRoomDoc, isValidRoom } from '@/canvas/wizard/build-room-doc';
import { ROOM_TYPES, type RoomType } from '@/canvas/wizard/room-types';
import type { CanvasDoc } from '@/canvas/types';

export type { RoomType };

/** Icono (emoji) por tipo de sala, para hacer los chips reconocibles de un vistazo. */
const ROOM_ICONS: Record<RoomType, string> = {
  salon: '🛋️',
  dormitorio: '🛏️',
  cocina: '🍳',
  bano: '🛁',
};

/** Límites de las medidas (m) para los sliders. */
const MIN_M = 1.5;
const MAX_M = 12;
const MIN_H = 2;
const MAX_H = 4;

interface Props {
  onCreate: (doc: CanvasDoc, roomType: RoomType) => void;
  onSkip: () => void;
}

/** Previsualización en vivo de la sala (planta a escala dentro de un recuadro fijo). */
function RoomPreview({ widthM, lengthM }: { widthM: number; lengthM: number }) {
  const BOX = 120; // lado del área de preview (px)
  const PAD = 10;
  const w = Number.isFinite(widthM) && widthM > 0 ? widthM : 1;
  const l = Number.isFinite(lengthM) && lengthM > 0 ? lengthM : 1;
  const scale = (BOX - 2 * PAD) / Math.max(w, l);
  const rw = w * scale;
  const rl = l * scale;
  return (
    <svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} aria-hidden className="shrink-0">
      <rect x={0} y={0} width={BOX} height={BOX} fill="#f0ebe1" rx={6} />
      <rect
        x={(BOX - rw) / 2}
        y={(BOX - rl) / 2}
        width={rw}
        height={rl}
        fill="#ffffff"
        stroke="#6b6258"
        strokeWidth={3}
      />
      <text x={BOX / 2} y={BOX - 3} textAnchor="middle" fontSize={9} fill="#6b6258" fontFamily="monospace">
        {w} × {l} m
      </text>
    </svg>
  );
}

export function DesignWizard({ onCreate, onSkip }: Props) {
  const [widthM, setWidthM] = useState(4);
  const [lengthM, setLengthM] = useState(3);
  const [ceilingM, setCeilingM] = useState(2.5);
  const [roomType, setRoomType] = useState<RoomType>('salon');

  const params = { widthM, lengthM, ceilingHeightM: ceilingM };
  const valid = isValidRoom(params);

  const create = () => {
    if (valid) onCreate(buildRoomDoc(params), roomType);
  };

  const slider = (label: string, value: number, set: (v: number) => void, min: number, max: number) => (
    <label className="flex flex-col gap-1">
      <span className="text-ink-soft flex justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums">{value} m</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => set(parseFloat(e.target.value))}
        aria-label={label}
        className="accent-brand-500"
      />
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Asistente de diseño"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onSkip();
      }}
    >
      <div className="bg-surface w-full max-w-md rounded-card border border-line p-4 shadow-lg">
        <h2 className="text-ink mb-1 text-base font-medium">Crear tu sala</h2>
        <p className="text-ink-soft mb-3 text-xs">
          Ajusta las medidas y elige el tipo; dibujamos las paredes y colocamos los muebles. Luego
          puedes editarlo todo.
        </p>

        <div className="mb-3 flex gap-4">
          <RoomPreview widthM={widthM} lengthM={lengthM} />
          <div className="flex flex-1 flex-col gap-2">
            {slider('Ancho', widthM, setWidthM, MIN_M, MAX_M)}
            {slider('Largo', lengthM, setLengthM, MIN_M, MAX_M)}
            {slider('Alto', ceilingM, setCeilingM, MIN_H, MAX_H)}
          </div>
        </div>

        <div className="mb-4">
          <span className="text-ink-soft mb-1 block text-xs">Tipo de sala</span>
          <div className="grid grid-cols-4 gap-1">
            {ROOM_TYPES.map((rt) => (
              <button
                key={rt.id}
                type="button"
                onClick={() => setRoomType(rt.id)}
                className={
                  'flex flex-col items-center gap-1 rounded-control border px-1 py-2 text-xs transition-colors ' +
                  (roomType === rt.id
                    ? 'border-brand-500 bg-brand-500/10 text-ink'
                    : 'border-line text-ink-soft hover:bg-surface-muted')
                }
              >
                <span className="text-lg" aria-hidden>
                  {ROOM_ICONS[rt.id]}
                </span>
                {rt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            Dibujar a mano
          </Button>
          <Button type="button" size="sm" onClick={create} disabled={!valid}>
            Crear sala
          </Button>
        </div>
      </div>
    </div>
  );
}
