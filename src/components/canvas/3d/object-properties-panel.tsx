'use client';

/**
 * Panel de propiedades del objeto seleccionado en 3D (F3 editor): inputs de Ancho,
 * Fondo (en cm) y Ángulo (en grados). Aparece anclado a la parte inferior del overlay.
 * Editar un campo y pulsar Enter/Tab/clic fuera escribe en el store (un updateObject).
 *
 * El campo Ángulo usa `rotatePatch` para mantener el centro del objeto fijo al rotar
 * (mismo invariante que el gizmo de F2).
 */
import { useState, useEffect } from 'react';
import type { StructObj } from '@/canvas/types';
import { pxToMeters, metersToPx } from '@/canvas/scale';
import { rotatePatch, type SceneCoords } from '@/canvas/3d/scene-to-doc';
import { rotation2DToY } from '@/canvas/3d/doc-to-scene';

export function ObjectPropertiesPanel({
  obj,
  pxPerMeter,
  scene,
  onChange,
}: {
  obj: StructObj;
  pxPerMeter: number;
  scene: SceneCoords;
  onChange: (patch: Partial<StructObj>) => void;
}) {
  const scale = { pxPerMeter };

  // Estado local de los inputs (no controlados externamente para permitir tipeo libre).
  const [wCm, setWCm] = useState(() => toCm(obj.width, pxPerMeter));
  const [hCm, setHCm] = useState(() => toCm(obj.height, pxPerMeter));
  const [deg, setDeg] = useState(() => Math.round(obj.rotation || 0));

  // Sincronizar cuando cambia la selección (nuevo objeto).
  useEffect(() => {
    setWCm(toCm(obj.width, pxPerMeter));
    setHCm(toCm(obj.height, pxPerMeter));
    setDeg(Math.round(obj.rotation || 0));
  }, [obj.id, pxPerMeter]);

  const commitWidth = () => {
    const px = Math.round(metersToPx(Math.max(1, wCm) / 100, scale));
    if (Math.abs(px - obj.width) > 0.5) onChange({ width: px });
  };

  const commitHeight = () => {
    const px = Math.round(metersToPx(Math.max(1, hCm) / 100, scale));
    if (Math.abs(px - obj.height) > 0.5) onChange({ height: px });
  };

  const commitAngle = () => {
    const normalized = ((deg % 360) + 360) % 360;
    if (Math.abs(normalized - (obj.rotation || 0)) < 0.5) return;
    onChange(rotatePatch(obj, rotation2DToY(normalized), scene));
  };

  return (
    <div className="absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-t-lg bg-neutral-900/95 px-4 py-2 shadow-xl ring-1 ring-white/20">
      <span className="text-xs text-white/50">Propiedades</span>
      <NumInput label="Ancho cm" value={wCm} onChange={setWCm} onCommit={commitWidth} />
      <NumInput label="Fondo cm" value={hCm} onChange={setHCm} onCommit={commitHeight} />
      <NumInput label="Ángulo °" value={deg} onChange={setDeg} onCommit={commitAngle} step={15} />
    </div>
  );
}

function toCm(px: number, pxPerMeter: number): number {
  return Math.round(pxToMeters(px, { pxPerMeter }) * 100);
}

function NumInput({
  label,
  value,
  onChange,
  onCommit,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit: () => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-white/50">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-20 rounded bg-neutral-800 px-2 py-1 text-center text-xs text-white"
      />
    </label>
  );
}
