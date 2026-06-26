'use client';

/**
 * Panel flotante de控制 de luz para el plano 2D. Aparece al seleccionar un objeto
 * con `light` (foco, plafón, colgante, aplique). Muestra on/off, intensidad y
 * temperatura K — los mismos controles que el ObjectPropertiesPanel del 3D.
 */
import { useCanvasStore } from '@/canvas/canvas-store';
import type { StructObj, LightProps } from '@/canvas/types';
import { clampIntensity } from '@/canvas/light';

export function LightControlPanel({
  obj,
  x,
  y,
}: {
  obj: StructObj;
  x: number;
  y: number;
}) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const lp = obj.light;
  if (!lp) return null;

  const isOn = lp.on !== false;
  const setLight = (patch: Partial<LightProps>) =>
    updateObject(obj.id, { light: { ...lp, ...patch } });

  return (
    <div
      className="absolute z-20 flex flex-col gap-1.5 rounded-lg bg-neutral-900/95 px-3 py-2 shadow-xl ring-1 ring-white/20"
      style={{ left: x, top: y + 50 }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/50">Luz</span>
        <button
          type="button"
          onClick={() => setLight({ on: !isOn })}
          className={`rounded px-2 py-0.5 text-xs ${isOn ? 'bg-yellow-600 text-white' : 'bg-neutral-800 text-white/50'}`}
        >
          {isOn ? '💡 On' : '⬛ Off'}
        </button>
      </div>
      {isOn && (
        <>
          <label className="flex items-center gap-2">
            <span className="text-[10px] text-white/50 w-12">Intens.</span>
            <input
              type="range" min={0} max={100} value={lp.intensidad}
              onChange={(e) => setLight({ intensidad: clampIntensity(Number(e.target.value)) })}
              className="w-24 accent-yellow-500"
            />
            <span className="text-[10px] text-white/60 tabular-nums">{lp.intensidad}%</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[10px] text-white/50 w-12">Temp K</span>
            <input
              type="range" min={2700} max={6500} step={100}
              value={lp.temperature ?? 4000}
              onChange={(e) => setLight({ temperature: Number(e.target.value) })}
              className="w-24 accent-sky-500"
            />
            <span className="text-[10px] text-white/60 tabular-nums">{lp.temperature ?? 4000}K</span>
          </label>
        </>
      )}
    </div>
  );
}
