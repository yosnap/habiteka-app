'use client';

/**
 * Asistente de diseño guiado (F7.4), estilo Planner5D. Desde un proyecto/zona vacío guía al
 * usuario por pasos: dimensiones de la sala → tipo de sala → crear. Genera un `CanvasDoc` con
 * el contorno de muros (lógica pura `buildRoomDoc`) y lo entrega al workspace, que lo carga y
 * lo persiste. El auto-amueblado por tipo de sala llega en F7.5; aquí el tipo solo se elige.
 *
 * Diálogo accesible (rol dialog + Escape). Se puede saltar para dibujar a mano.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { buildRoomDoc, isValidRoom } from '@/canvas/wizard/build-room-doc';
import type { CanvasDoc } from '@/canvas/types';

/** Tipos de sala ofrecidos (el set de auto-amueblado por tipo es F7.5). */
export const ROOM_TYPES = [
  { id: 'salon', label: 'Salón' },
  { id: 'dormitorio', label: 'Dormitorio' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'bano', label: 'Baño' },
] as const;

export type RoomType = (typeof ROOM_TYPES)[number]['id'];

interface Props {
  /** Recibe el doc generado (y el tipo elegido, para F7.5) y lo aplica en el editor. */
  onCreate: (doc: CanvasDoc, roomType: RoomType) => void;
  /** Cierra el asistente sin crear (dibujar a mano). */
  onSkip: () => void;
}

export function DesignWizard({ onCreate, onSkip }: Props) {
  const [widthM, setWidthM] = useState('4');
  const [lengthM, setLengthM] = useState('3');
  const [ceilingM, setCeilingM] = useState('2.5');
  const [roomType, setRoomType] = useState<RoomType>('salon');

  const params = {
    widthM: parseFloat(widthM.replace(',', '.')),
    lengthM: parseFloat(lengthM.replace(',', '.')),
    ceilingHeightM: parseFloat(ceilingM.replace(',', '.')),
  };
  const valid = isValidRoom(params);

  const create = () => {
    if (!valid) return;
    onCreate(buildRoomDoc(params), roomType);
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-ink-soft text-xs">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min="0"
        value={value}
        onChange={(e) => set(e.target.value)}
        className="border-line text-ink rounded-control border px-2 py-1 text-sm tabular-nums"
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
      <div className="bg-surface w-full max-w-sm rounded-card border border-line p-4 shadow-lg">
        <h2 className="text-ink mb-1 text-base font-medium">Crear tu sala</h2>
        <p className="text-ink-soft mb-3 text-xs">
          Indica las medidas y el tipo de sala; dibujaremos las paredes por ti. Luego puedes
          editar el plano o añadir muebles.
        </p>

        <div className="mb-3 flex flex-col gap-3">
          <div className="flex gap-2">
            {field('Ancho (m)', widthM, setWidthM)}
            {field('Largo (m)', lengthM, setLengthM)}
            {field('Alto (m)', ceilingM, setCeilingM)}
          </div>

          <div>
            <span className="text-ink-soft mb-1 block text-xs">Tipo de sala</span>
            <div className="flex flex-wrap gap-1">
              {ROOM_TYPES.map((rt) => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => setRoomType(rt.id)}
                  className={
                    roomType === rt.id
                      ? 'bg-brand-500 rounded-control px-2 py-1 text-sm text-white'
                      : 'text-ink hover:bg-surface-muted rounded-control px-2 py-1 text-sm'
                  }
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          {!valid ? (
            <p className="text-destructive text-xs" role="alert">
              Introduce medidas positivas para ancho, largo y alto.
            </p>
          ) : null}
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
