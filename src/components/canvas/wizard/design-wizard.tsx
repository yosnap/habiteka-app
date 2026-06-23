'use client';

/**
 * Asistente de diseño guiado (F7.4/F7.8), estilo Planner5D. Desde una zona vacía guía al
 * usuario: medidas de la sala (con sliders y previsualización en vivo) → tipo de sala → crear.
 * Genera un `CanvasDoc` con el contorno de muros (lógica pura `buildRoomDoc`) y lo entrega al
 * workspace, que lo amuebla según el tipo, lo carga y lo persiste.
 *
 * Diálogo accesible (rol dialog + Escape). Se puede saltar para dibujar a mano.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { buildShapeDoc, isValidShapeRoom } from '@/canvas/wizard/build-room-doc';
import type { RoomShape, RoomShapeParams } from '@/canvas/wizard/room-shapes';
import { ROOM_TYPES, type RoomType } from '@/canvas/wizard/room-types';
import {
  ROOM_FURNITURE,
  defaultSelection,
  type FurnitureSelection,
} from '@/canvas/wizard/room-furniture-options';
import type { CanvasDoc } from '@/canvas/types';
import { RoomShapePreview } from './room-shape-preview';

export type { RoomType };

/** Icono (emoji) por tipo de sala, para hacer los chips reconocibles de un vistazo. */
const ROOM_ICONS: Record<RoomType, string> = {
  salon: '🛋️',
  dormitorio: '🛏️',
  cocina: '🍳',
  bano: '🛁',
};

/** Formas de sala ofrecidas, con su etiqueta e icono esquemático. */
const SHAPES: { id: RoomShape; label: string; icon: string }[] = [
  { id: 'rect', label: 'Rectángulo', icon: '▭' },
  { id: 'l', label: 'L', icon: '⌐' },
  { id: 'u', label: 'U', icon: '⊔' },
  { id: 't', label: 'T', icon: '⊤' },
];

/** Límites de las medidas (m) para los sliders. */
const MIN_M = 1.5;
const MAX_M = 12;
const MIN_H = 2;
const MAX_H = 4;
/** Mínimo para recortes/entrantes/vástagos (m). */
const MIN_CUT_M = 0.5;

interface Props {
  onCreate: (doc: CanvasDoc, roomType: RoomType, selection: FurnitureSelection) => void;
  onSkip: () => void;
}

export function DesignWizard({ onCreate, onSkip }: Props) {
  const [step, setStep] = useState<'room' | 'furniture'>('room');
  const [shape, setShape] = useState<RoomShape>('rect');
  const [widthM, setWidthM] = useState(4);
  const [lengthM, setLengthM] = useState(3);
  const [ceilingM, setCeilingM] = useState(2.5);
  // Parámetros secundarios por forma (recorte L, entrante U, barra/vástago T). Tienen
  // defaults sensatos y se acotan dentro de width/length por `isValidShape`.
  const [cutWidthM, setCutWidthM] = useState(1.5);
  const [cutLengthM, setCutLengthM] = useState(1.5);
  const [notchWidthM, setNotchWidthM] = useState(1.5);
  const [notchLengthM, setNotchLengthM] = useState(1.5);
  const [barLengthM, setBarLengthM] = useState(1.5);
  const [stemWidthM, setStemWidthM] = useState(1.5);
  const [roomType, setRoomType] = useState<RoomType>('salon');
  const [selection, setSelection] = useState<FurnitureSelection>(() => defaultSelection('salon'));
  // Tipo con el que se calculó la selección: resetear la selección SOLO al cambiar de tipo (no al
  // cambiar medidas), para no descartar lo que el usuario marcó.
  const [selectionType, setSelectionType] = useState<RoomType>('salon');

  // Parámetros de la forma activa, derivados del estado (sin efectos): cada forma toma sus
  // medidas secundarias; el rectángulo solo usa width/length.
  const shapeParams = useMemo<RoomShapeParams>(() => {
    switch (shape) {
      case 'rect':
        return { shape: 'rect', widthM, lengthM };
      case 'l':
        return { shape: 'l', widthM, lengthM, cutWidthM, cutLengthM };
      case 'u':
        return { shape: 'u', widthM, lengthM, notchWidthM, notchLengthM };
      case 't':
        return { shape: 't', widthM, lengthM, barLengthM, stemWidthM };
    }
  }, [shape, widthM, lengthM, cutWidthM, cutLengthM, notchWidthM, notchLengthM, barLengthM, stemWidthM]);

  const roomParams = { shape: shapeParams, ceilingHeightM: ceilingM };
  const valid = isValidShapeRoom(roomParams);

  // Avanza al paso de muebles; si cambió el tipo desde la última selección, la recalcula.
  const goToFurniture = () => {
    if (!valid) return;
    if (selectionType !== roomType) {
      setSelection(defaultSelection(roomType));
      setSelectionType(roomType);
    }
    setStep('furniture');
  };

  const toggle = (kind: string, on: boolean) =>
    setSelection((s) => ({ ...s, [kind]: on ? 1 : 0 }));

  const setQty = (kind: string, qty: number, max: number) =>
    setSelection((s) => ({ ...s, [kind]: Math.max(0, Math.min(qty, max)) }));

  const create = () => {
    if (valid) onCreate(buildShapeDoc(roomParams), roomType, selection);
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
        {step === 'room' ? (
          <>
            <h2 className="text-ink mb-1 text-base font-medium">Crear tu sala</h2>
            <p className="text-ink-soft mb-3 text-xs">
              Elige la forma, ajusta las medidas y el tipo. En el siguiente paso eliges los muebles.
            </p>

            <div className="mb-3">
              <span className="text-ink-soft mb-1 block text-xs">Forma</span>
              <div className="grid grid-cols-4 gap-1">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setShape(s.id)}
                    aria-pressed={shape === s.id}
                    className={
                      'flex flex-col items-center gap-1 rounded-control border px-1 py-2 text-xs transition-colors ' +
                      (shape === s.id
                        ? 'border-brand-500 bg-brand-500/10 text-ink'
                        : 'border-line text-ink-soft hover:bg-surface-muted')
                    }
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {s.icon}
                    </span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex gap-4">
              <RoomShapePreview params={shapeParams} label={`${widthM} × ${lengthM} m`} />
              <div className="flex flex-1 flex-col gap-2">
                {slider('Ancho', widthM, setWidthM, MIN_M, MAX_M)}
                {slider('Largo', lengthM, setLengthM, MIN_M, MAX_M)}
                {slider('Alto', ceilingM, setCeilingM, MIN_H, MAX_H)}
                {shape === 'l' ? (
                  <>
                    {slider('Recorte ancho', cutWidthM, setCutWidthM, MIN_CUT_M, MAX_M)}
                    {slider('Recorte largo', cutLengthM, setCutLengthM, MIN_CUT_M, MAX_M)}
                  </>
                ) : null}
                {shape === 'u' ? (
                  <>
                    {slider('Entrante ancho', notchWidthM, setNotchWidthM, MIN_CUT_M, MAX_M)}
                    {slider('Entrante fondo', notchLengthM, setNotchLengthM, MIN_CUT_M, MAX_M)}
                  </>
                ) : null}
                {shape === 't' ? (
                  <>
                    {slider('Barra (largo)', barLengthM, setBarLengthM, MIN_CUT_M, MAX_M)}
                    {slider('Vástago (ancho)', stemWidthM, setStemWidthM, MIN_CUT_M, MAX_M)}
                  </>
                ) : null}
              </div>
            </div>

            {!valid ? (
              <p className="mb-3 text-xs text-red-500">
                Las medidas del recorte deben ser menores que el ancho y el largo de la sala.
              </p>
            ) : null}

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
              <Button type="button" size="sm" onClick={goToFurniture} disabled={!valid}>
                Siguiente
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-ink mb-1 text-base font-medium">¿Qué muebles necesitas?</h2>
            <p className="text-ink-soft mb-3 text-xs">
              Marca lo que tengas; ajusta las cantidades. Colocamos solo lo que elijas.
            </p>

            <ul className="mb-4 max-h-64 space-y-1 overflow-y-auto">
              {(ROOM_FURNITURE[roomType] ?? []).map((o) => {
                const qty = selection[o.kind] ?? 0;
                const checked = qty > 0;
                return (
                  <li
                    key={o.kind}
                    className="border-line flex items-center justify-between gap-2 rounded-control border px-2 py-1.5"
                  >
                    <label className="flex flex-1 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggle(o.kind, e.target.checked)}
                        className="accent-brand-500"
                      />
                      <span className="text-ink">{o.label}</span>
                      {o.default ? null : (
                        <span className="text-ink-soft text-[10px]">opcional</span>
                      )}
                    </label>
                    {o.repeatable && checked ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Menos ${o.label}`}
                          onClick={() => setQty(o.kind, qty - 1, o.maxQty ?? 9)}
                          className="border-line text-ink rounded-control border px-2 leading-none"
                        >
                          −
                        </button>
                        <span className="text-ink w-4 text-center text-sm tabular-nums">{qty}</span>
                        <button
                          type="button"
                          aria-label={`Más ${o.label}`}
                          onClick={() => setQty(o.kind, qty + 1, o.maxQty ?? 9)}
                          className="border-line text-ink rounded-control border px-2 leading-none"
                        >
                          ＋
                        </button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep('room')}>
                Atrás
              </Button>
              <Button type="button" size="sm" onClick={create} disabled={!valid}>
                Crear sala
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
