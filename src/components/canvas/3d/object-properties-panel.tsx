'use client';

/**
 * Panel de propiedades del objeto seleccionado en 3D (F3 editor): Ancho, Fondo (cm),
 * Altura (cm), Ángulo (°) y Elevación (cm). Cada campo soporta tipeo libre y scrub
 * (clic+arrastrar ←→). `onLive` escribe al store en cada frame del scrub para que la
 * vista 3D se actualice en vivo.
 */
import { useState, useEffect, useRef } from 'react';
import type { StructObj } from '@/canvas/types';
import { pxToMeters, metersToPx, effectiveHeightM, DEFAULT_CEILING_M } from '@/canvas/scale';
import { rotatePatch, type SceneCoords } from '@/canvas/3d/scene-to-doc';
import { rotation2DToY } from '@/canvas/3d/doc-to-scene';

/** Solo los muros carecen de Elevación editable (ventanas y puertas sí la tienen: alféizar). */
const STRUCTURAL_KINDS = new Set(['wall', 'window', 'door']);

export function ObjectPropertiesPanel({
  obj,
  pxPerMeter,
  scene,
  onChange,
  ceilingHeightM = DEFAULT_CEILING_M,
}: {
  obj: StructObj;
  pxPerMeter: number;
  scene: SceneCoords;
  onChange: (patch: Partial<StructObj>) => void;
  ceilingHeightM?: number;
}) {
  const scale = { pxPerMeter };
  const isFurniture = !STRUCTURAL_KINDS.has(obj.kind);

  const [wCm, setWCm] = useState(() => toCm(obj.width, pxPerMeter));
  const [hCm, setHCm] = useState(() => toCm(obj.height, pxPerMeter));
  const [altCm, setAltCm] = useState(() => Math.round(effectiveHeightM(obj, ceilingHeightM) * 100));
  const [deg, setDeg] = useState(() => Math.round(obj.rotation || 0));
  const [elevCm, setElevCm] = useState(() => Math.round((obj.elevationM ?? 0) * 100));

  useEffect(() => {
    setWCm(toCm(obj.width, pxPerMeter));
    setHCm(toCm(obj.height, pxPerMeter));
    setAltCm(Math.round(effectiveHeightM(obj, ceilingHeightM) * 100));
    setDeg(Math.round(obj.rotation || 0));
    setElevCm(Math.round((obj.elevationM ?? 0) * 100));
  }, [obj.id, pxPerMeter, ceilingHeightM]);

  // ── Commits ────────────────────────────────────────────────────────────────
  const commitWidth = () => {
    const px = Math.round(metersToPx(Math.max(1, wCm) / 100, scale));
    if (Math.abs(px - obj.width) > 0.5) onChange({ width: px });
  };
  const commitHeight = () => {
    const px = Math.round(metersToPx(Math.max(1, hCm) / 100, scale));
    if (Math.abs(px - obj.height) > 0.5) onChange({ height: px });
  };
  const commitAlt = () => {
    const m = Math.max(0.01, altCm) / 100;
    if (Math.abs(m - effectiveHeightM(obj, ceilingHeightM)) < 0.005) return;
    onChange({ heightM: m });
  };
  const commitAngle = () => {
    const normalized = ((deg % 360) + 360) % 360;
    if (Math.abs(normalized - (obj.rotation || 0)) < 0.5) return;
    onChange(rotatePatch(obj, rotation2DToY(normalized), scene));
  };
  const commitElev = () => {
    const m = Math.max(0, elevCm) / 100;
    if (Math.abs(m - (obj.elevationM ?? 0)) < 0.005) return;
    onChange({ elevationM: m });
  };

  // ── Live (scrub en vivo → store) ───────────────────────────────────────────
  const liveWidth = (v: number) => onChange({ width: Math.round(metersToPx(Math.max(1, v) / 100, scale)) });
  const liveHeight = (v: number) => onChange({ height: Math.round(metersToPx(Math.max(1, v) / 100, scale)) });
  const liveAlt = (v: number) => onChange({ heightM: Math.max(0.01, v) / 100 });
  const liveAngle = (v: number) => {
    const normalized = ((v % 360) + 360) % 360;
    onChange(rotatePatch(obj, rotation2DToY(normalized), scene));
  };
  const liveElev = (v: number) => onChange({ elevationM: Math.max(0, v) / 100 });

  const isHidden = !!obj.hidden;

  return (
    <div className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-t-lg bg-neutral-900/95 px-4 py-2 shadow-xl ring-1 ring-white/20">
      <span className="text-xs text-white/50">Propiedades</span>
      <NumInput label="Ancho cm" value={wCm} onChange={setWCm} onCommit={commitWidth} onLive={liveWidth} />
      <NumInput label="Fondo cm" value={hCm} onChange={setHCm} onCommit={commitHeight} onLive={liveHeight} />
      <NumInput label="Alt. cm"  value={altCm} onChange={setAltCm} onCommit={commitAlt} onLive={liveAlt} />
      <NumInput label="Ángulo °" value={deg} onChange={setDeg} onCommit={commitAngle} onLive={liveAngle} step={15} />
      {(isFurniture || obj.kind === 'window') && (
        <NumInput
          label={obj.kind === 'window' ? 'Alféizar cm' : 'Elev. cm'}
          value={elevCm}
          onChange={setElevCm}
          onCommit={commitElev}
          onLive={liveElev}
        />
      )}
      {!isFurniture && obj.kind === 'wall' && (
        <button
          type="button"
          onClick={() => onChange({ hidden: !isHidden })}
          className="flex flex-col items-center gap-0.5"
          title={isHidden ? 'Mostrar pared' : 'Ocultar pared'}
        >
          <span className="text-[10px] text-white/50">Visib.</span>
          <span className="rounded bg-neutral-800 px-2 py-1 text-xs text-white hover:bg-neutral-700">
            {isHidden ? '👁' : '🚫'}
          </span>
        </button>
      )}
    </div>
  );
}

function toCm(px: number, pxPerMeter: number): number {
  return Math.round(pxToMeters(px, { pxPerMeter }) * 100);
}

/**
 * Input numérico con scrub: clic+arrastrar ←→ decrementa/incrementa (1 px = 1 unidad).
 * - `onChange`  → estado local (el input muestra el valor mientras se escribe/arrastra).
 * - `onLive`   → store en cada frame del scrub → vista 3D en vivo.
 * - `onCommit` → store al soltar o al blur/Enter.
 */
function NumInput({
  label,
  value,
  onChange,
  onCommit,
  onLive,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit: () => void;
  onLive?: (v: number) => void;
  step?: number;
}) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startVal = useRef(0);

  return (
    <label className="flex flex-col items-center gap-0.5 select-none">
      <span className="text-[10px] text-white/50">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => {
          if (isDragging.current) return;
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        onBlur={() => { if (!isDragging.current) onCommit(); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          isDragging.current = false;
          startX.current = e.clientX;
          startVal.current = value;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const dx = e.clientX - startX.current;
          if (!isDragging.current) {
            if (Math.abs(dx) < 3) return;
            isDragging.current = true;
            e.currentTarget.blur();
          }
          const newVal = Math.round(startVal.current + dx);
          onChange(newVal);
          onLive?.(newVal);
        }}
        onPointerUp={() => {
          if (isDragging.current) {
            isDragging.current = false;
            onCommit();
          }
        }}
        className="w-20 cursor-ew-resize rounded bg-neutral-800 px-2 py-1 text-center text-xs text-white"
      />
    </label>
  );
}
