'use client';

/**
 * Smart Wizard — Paso 3: Tipo y estilo de la sala.
 * Tabs de tipo de sala → grid de estilos → auto-amueblado procedural → preview 3D isométrico.
 * El botón "Aleatorio" redistribuye los muebles sin cambiar tipo ni estilo.
 */
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { buildShapeDoc } from '@/canvas/wizard/build-room-doc';
import { autofurnish } from '@/canvas/wizard/autofurnish';
import { defaultSelection, type FurnitureSelection } from '@/canvas/wizard/room-furniture-options';
import { ROOM_TYPES, type RoomType } from '@/canvas/wizard/room-types';
import { getStylesForType, type RoomStyle } from '@/canvas/wizard/room-styles';
import type { CanvasDoc } from '@/canvas/types';
import type { ShapeState } from './step-shape';
import { buildParams } from './step-shape';

// Carga dinámica del preview 3D para evitar SSR (three.js no es compatible con Node).
const IsometricPreview = dynamic(
  () => import('./isometric-preview').then((m) => m.IsometricPreview),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-surface-muted" /> },
);

/** Mezcla aleatoria de la selección: varía las cantidades de items repetibles. */
function randomizeSelection(base: FurnitureSelection): FurnitureSelection {
  const result: FurnitureSelection = {};
  for (const [kind, qty] of Object.entries(base)) {
    if (qty === 0) {
      // Items opcionales: 40% de probabilidad de incluirlos.
      result[kind] = Math.random() < 0.4 ? 1 : 0;
    } else {
      // Items seleccionados: ±1 unidad (mínimo 1).
      const delta = Math.floor(Math.random() * 3) - 1; // -1, 0 o +1
      result[kind] = Math.max(1, qty + delta);
    }
  }
  return result;
}

function computeDoc(
  shapeState: ShapeState,
  roomType: RoomType,
  selection: FurnitureSelection,
): CanvasDoc {
  const params = buildParams(shapeState);
  const roomDoc = buildShapeDoc({ shape: params, ceilingHeightM: shapeState.ceilingM });
  const { objects: placed } = autofurnish(roomDoc, roomType, selection);
  return { ...roomDoc, objects: [...roomDoc.objects, ...placed] };
}

interface Props {
  shapeState: ShapeState;
  onBack: () => void;
  onComplete: (doc: CanvasDoc, roomType: RoomType) => void;
}

export function StepStyle({ shapeState, onBack, onComplete }: Props) {
  const [roomType, setRoomType] = useState<RoomType>('salon');
  const [selectedStyle, setSelectedStyle] = useState<RoomStyle | null>(null);
  const [selection, setSelection] = useState<FurnitureSelection>(() => defaultSelection('salon'));
  const [furnishedDoc, setFurnishedDoc] = useState<CanvasDoc | null>(null);
  const [spinning, setSpinning] = useState(false);

  const styles = getStylesForType(roomType);

  // Al cambiar tipo: resetear estilo y recalcular selección por defecto.
  function handleRoomType(type: RoomType) {
    setRoomType(type);
    setSelectedStyle(null);
    const sel = defaultSelection(type);
    setSelection(sel);
    runFurnish(sel, type);
  }

  function runFurnish(sel: FurnitureSelection, type: RoomType = roomType) {
    setSpinning(true);
    // Simulamos un breve delay para dar retroalimentación visual ("Creando magia…")
    // mientras el cálculo procedural es síncrono y rápido.
    setTimeout(() => {
      const doc = computeDoc(shapeState, type, sel);
      setFurnishedDoc(doc);
      setSpinning(false);
    }, 400);
  }

  function handleStyle(style: RoomStyle) {
    setSelectedStyle(style);
    runFurnish(selection);
  }

  function handleAleatorio() {
    const randomSel = randomizeSelection(selection);
    setSelection(randomSel);
    runFurnish(randomSel);
  }

  // Calcular doc inicial al montar.
  useEffect(() => {
    const sel = defaultSelection('salon');
    setSelection(sel);
    runFurnish(sel, 'salon');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canComplete = furnishedDoc !== null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-ink-soft mb-1 text-xs font-semibold uppercase tracking-wider">
          Paso 3 de 3 · Tipo y estilo
        </p>
        <h2 className="text-ink text-base font-semibold">¿Qué tipo de sala es?</h2>
      </div>

      {/* Tabs tipo de sala */}
      <div className="flex flex-wrap gap-1">
        {ROOM_TYPES.map((rt) => (
          <button
            key={rt.id}
            type="button"
            onClick={() => handleRoomType(rt.id)}
            className={
              'rounded-control px-3 py-1 text-xs font-medium transition-colors ' +
              (roomType === rt.id
                ? 'bg-brand-500 text-white'
                : 'bg-surface-muted text-ink-soft hover:bg-surface-hover')
            }
          >
            {rt.label}
          </button>
        ))}
      </div>

      {/* Layout: grid de estilos izq. + preview der. */}
      <div className="flex gap-3" style={{ minHeight: 220 }}>
        {/* Grid de fotos de estilo */}
        <div className="grid grid-cols-2 gap-2 w-36 shrink-0 content-start">
          {styles.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => handleStyle(style)}
              title={style.label}
              className={
                'group relative overflow-hidden rounded-lg transition-all ' +
                (selectedStyle?.id === style.id
                  ? 'ring-2 ring-brand-500 ring-offset-1'
                  : 'hover:ring-1 hover:ring-brand-300')
              }
              style={{ height: 60 }}
            >
              {/* Imagen de estilo con degradado como fallback */}
              <div
                className="h-full w-full"
                style={{ background: `linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})` }}
              />
              <img
                src={style.imageUrl}
                alt={style.label}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="absolute inset-x-0 bottom-0 bg-black/40 py-0.5 text-center text-[9px] font-medium text-white">
                {style.label}
              </span>
            </button>
          ))}
        </div>

        {/* Preview 3D */}
        <div className="relative flex-1 rounded-lg overflow-hidden bg-surface-muted">
          {spinning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/80 z-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
              <span className="text-ink-soft text-xs">Creando magia…</span>
            </div>
          ) : null}

          {furnishedDoc ? (
            <IsometricPreview
              doc={furnishedDoc}
              ceilingH={shapeState.ceilingM}
              className="h-full w-full"
            />
          ) : (
            <div className="h-full w-full animate-pulse rounded-lg bg-surface-muted" />
          )}
        </div>
      </div>

      {/* Botón Aleatorio */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleAleatorio}
          disabled={spinning}
          className="flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-brand-400 hover:text-brand-600 disabled:opacity-40"
        >
          <span aria-hidden>↺</span>
          Aleatorio
        </button>
      </div>

      {/* Botones navegación */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="text-ink-soft hover:text-ink rounded-control px-3 py-1.5 text-sm"
        >
          ← Volver
        </button>
        <button
          type="button"
          disabled={!canComplete || spinning}
          onClick={() => furnishedDoc && onComplete(furnishedDoc, roomType)}
          className="rounded-control bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          ✓ Completo
        </button>
      </div>
    </div>
  );
}
